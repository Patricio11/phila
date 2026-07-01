"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { sendTeamMessageDb, sendToThreadDb, createGroupThreadDb, markThreadReadDb, getUserName, editMessageDb, deleteMessageDb, getAttachmentAccess, listMemberThreadIds } from "@/db/queries/messages";
import { currentStorageBytes, addStorageUsage } from "@/db/queries/documents";
import { broadcastToThread, broadcastThreadAdded, broadcastMessageUpdate, getRealtimeAuthSecret, signRealtimeToken } from "@/lib/messaging/realtime";
import { getStorageProvider, objectKey } from "@/lib/storage";
import { validateUpload, storageLimitBytes } from "@/lib/documents/quota";
import { randomUUID } from "node:crypto";

/**
 * Internal team messaging  staff-to-staff (hub ↔ counsellor, counsellor ↔
 * counsellor). Persisted to Neon (the source of truth); validated + audited. The
 * composer keeps an optimistic copy. Client notices go out over SMS/WhatsApp,
 * never here. Live delivery + presence (Supabase Realtime) layer on top.
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

const attachmentInput = z.object({
  key: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(120),
  bytes: z.number().int().positive(),
});

const input = z
  .object({
    threadId: z.string().min(1).optional(),
    toUserId: z.string().min(1).optional(),
    text: z.string().trim().max(4000).default(""),
    attachment: attachmentInput.optional(),
  })
  .refine((d) => d.threadId || d.toUserId, { message: "Pick a conversation." })
  .refine((d) => d.text.trim().length > 0 || d.attachment, { message: "Write a message or attach a file." });

export async function sendTeamMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true; threadId?: string; messageId?: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send." };
  const d = parsed.data;
  const attachment = d.attachment;

  let threadId: string | undefined;
  let messageId: string | undefined;
  if (isDb()) {
    let sent;
    if (d.threadId && !d.threadId.startsWith("local_")) {
      sent = await sendToThreadDb(membership.orgId, principal.userId, d.threadId, d.text, attachment);
      if (!sent) return { ok: false, error: "You're not in that conversation." };
    } else if (d.toUserId) {
      sent = await sendTeamMessageDb(membership.orgId, principal.userId, d.toUserId, d.text, attachment);
    } else {
      return { ok: false, error: "Pick a conversation." };
    }
    threadId = sent.threadId;
    messageId = sent.messageId;
    // The attachment's bytes count against the org's storage.
    if (attachment) await addStorageUsage(membership.orgId, attachment.bytes);
    // Live delivery (Supabase Realtime) — best-effort, dormant if not configured.
    const senderName = await getUserName(principal.userId);
    await broadcastToThread(sent.threadId, {
      threadId: sent.threadId, id: sent.messageId, senderId: principal.userId, text: d.text, at: sent.createdAt, senderName,
      attachment: attachment ? { name: attachment.name, contentType: attachment.contentType, bytes: attachment.bytes } : undefined,
    });
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `team_message:${threadId ?? d.toUserId ?? "thread"}`,
    reason: attachment ? "send_team_message_attachment" : "send_team_message",
  });
  return { ok: true, threadId, messageId };
}

/** Presign a chat attachment upload. Validates type + size + the org's storage quota. */
const chatUploadInput = z.object({
  name: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(120),
  bytes: z.number().int().positive(),
});
export async function requestChatUpload(raw: z.infer<typeof chatUploadInput>): Promise<{ ok: true; uploadUrl: string; key: string } | { ok: false; error: string }> {
  const { membership } = await requireOrg();
  const parsed = chatUploadInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the file." };
  const v = validateUpload({ contentType: parsed.data.contentType, bytes: parsed.data.bytes });
  if (!v.ok) return v;
  if (!isDb()) return { ok: false, error: "Attachments aren't available in this demo." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Attachments aren't switched on yet." };
  const used = await currentStorageBytes(membership.orgId);
  if (used + parsed.data.bytes > storageLimitBytes())
    return { ok: false, error: "Your practice's storage is full — free up space or upgrade." };

  const key = objectKey(membership.orgId, `chat_${randomUUID()}`, parsed.data.name);
  try {
    const signed = await storage.signedUploadUrl({ key, contentType: parsed.data.contentType });
    return { ok: true, uploadUrl: signed.uploadUrl, key };
  } catch {
    return { ok: false, error: "Storage rejected the upload. Please try again." };
  }
}

/** Mint the caller's Supabase Realtime token (private-channel mode). Null = public mode. */
export async function getRealtimeToken(): Promise<{ token: string } | null> {
  const { principal, membership } = await requireOrg();
  const secret = await getRealtimeAuthSecret();
  if (!secret) return null;
  const threadIds = await listMemberThreadIds(principal.userId, membership.orgId);
  const topics = [...threadIds.map((id) => `thread:${id}`), `user:${principal.userId}`, `presence:org:${membership.orgId}`];
  return { token: signRealtimeToken(principal.userId, topics, secret) };
}

/** A short-TTL signed URL to open a chat attachment — members only. */
export async function signChatAttachment(raw: { messageId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const messageId = String(raw?.messageId ?? "");
  if (!messageId) return { ok: false, error: "Not found." };
  const acc = await getAttachmentAccess(messageId, principal.userId);
  if (!acc) return { ok: false, error: "That file isn't available to open." };
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Attachments aren't available right now." };
  let url: string;
  try {
    url = await storage.signedDownloadUrl(acc.key);
  } catch {
    return { ok: false, error: "Could not open the file." };
  }
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_message:${messageId}/attachment`, reason: "download" });
  return { ok: true, url };
}

const groupInput = z.object({
  title: z.string().trim().min(2, "Give the group a name.").max(60),
  memberUserIds: z.array(z.string().min(1)).min(1, "Add at least one teammate."),
});

export async function createGroup(
  raw: z.infer<typeof groupInput>,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = groupInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the group." };
  if (!isDb()) return { ok: false, error: "Groups need the database." };

  const threadId = await createGroupThreadDb(membership.orgId, principal.userId, parsed.data.title, parsed.data.memberUserIds);
  await broadcastThreadAdded(parsed.data.memberUserIds, { id: threadId, title: parsed.data.title, memberCount: parsed.data.memberUserIds.length + 1 });
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `team_group:${threadId}`,
    reason: "create_group",
  });
  return { ok: true, threadId };
}

/** Clear unread for a thread (move the read cursor). */
export async function markThreadRead(threadId: string): Promise<{ ok: boolean }> {
  const { principal } = await requireOrg();
  if (isDb() && threadId && !threadId.startsWith("local_")) await markThreadReadDb(threadId, principal.userId);
  return { ok: true };
}

const editInput = z.object({ messageId: z.string().min(1), text: z.string().trim().min(1, "Message can't be empty.").max(4000) });
export async function editMessage(raw: z.infer<typeof editInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = editInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the message." };
  if (isDb()) {
    const threadId = await editMessageDb(parsed.data.messageId, principal.userId, parsed.data.text);
    if (!threadId) return { ok: false, error: "You can only edit your own message." };
    await broadcastMessageUpdate(threadId, { messageId: parsed.data.messageId, text: parsed.data.text, edited: true, deleted: false });
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_message:${parsed.data.messageId}`, reason: "edit_message" });
  return { ok: true };
}

export async function deleteMessage(messageId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const id = String(messageId ?? "");
  if (!id || id.startsWith("local_")) return { ok: true };
  if (isDb()) {
    const threadId = await deleteMessageDb(id, principal.userId);
    if (!threadId) return { ok: false, error: "You can only delete your own message." };
    await broadcastMessageUpdate(threadId, { messageId: id, text: "", edited: false, deleted: true });
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_message:${id}`, reason: "delete_message" });
  return { ok: true };
}
