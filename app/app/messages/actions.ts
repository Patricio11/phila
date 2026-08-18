"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { requireMessagingPrincipal } from "@/lib/messaging/principal";
import { nudgeThreadMembers } from "@/lib/messaging/nudge";
import { after } from "next/server";
import { runForOrg } from "@/lib/db/scoped";
import { getDataProvider, type TeamThread } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { sendTeamMessageDb, sendToThreadDb, createGroupThreadDb, markThreadReadDb, getUserName, editMessageDb, deleteMessageDb, getAttachmentAccess, listMemberThreadIds, quotedMessageDb, toggleReactionDb, canManageGroupDb, renameGroupDb, addGroupMembersDb, removeGroupMemberDb, threadMembersDb, groupMembershipDb, findOrCreateClientThreadDb, threadKindDb, listTeamThreadsDb, isClientUserDb } from "@/db/queries/messages";
import { currentStorageBytes, addStorageUsage } from "@/db/queries/documents";
import { broadcastToThread, broadcastThreadAdded, broadcastMessageUpdate, broadcastReaction, broadcastThreadUpdated, broadcastThreadRemoved, getRealtimeAuthSecret, signRealtimeToken } from "@/lib/messaging/realtime";
import { getStorageProvider, activeStorageBackend, objectKey } from "@/lib/storage";
import { validateUpload } from "@/lib/documents/quota";
import { orgStorageLimitBytes } from "@/db/queries/resources";
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
    /** Batch 4g - quote a message from the same thread. */
    replyToId: z.string().min(1).optional(),
  })
  .refine((d) => d.threadId || d.toUserId, { message: "Pick a conversation." })
  .refine((d) => d.text.trim().length > 0 || d.attachment, { message: "Write a message or attach a file." });

export async function sendTeamMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true; threadId?: string; messageId?: string } | { ok: false; error: string }> {
  const me = await requireMessagingPrincipal();
  const principal = { userId: me.userId };
  const membership = { orgId: me.orgId, teamRole: me.kind === "staff" ? me.teamRole : null };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send." };
  const d = parsed.data;
  // Phase 34.1 - the client rules: reply only into THEIR practice thread, never
  // start one, never address a person, never attach.
  if (me.kind === "client") {
    if (!d.threadId || d.threadId.startsWith("local_") || d.toUserId) return { ok: false, error: "Your practice starts the conversation - you can reply here once they message you." };
    if (d.attachment) return { ok: false, error: "Files go through Documents, not chat." };
    const t = await threadKindDb(d.threadId);
    if (!t || t.kind !== "client" || t.clientId !== me.clientId || t.orgId !== me.orgId) return { ok: false, error: "You're not in that conversation." };
  }
  // Batch 2o - record which backend the bytes went to, so a later switch to S3
  // never orphans an attachment already sitting in the old bucket.
  const attachment = d.attachment ? { ...d.attachment, backend: await activeStorageBackend() } : undefined;

  let threadId: string | undefined;
  let messageId: string | undefined;
  if (isDb()) {
    let sent;
    if (d.threadId && !d.threadId.startsWith("local_")) {
      sent = await sendToThreadDb(membership.orgId, principal.userId, d.threadId, d.text, attachment, d.replyToId);
      if (!sent) return { ok: false, error: "You're not in that conversation." };
    } else if (d.toUserId) {
      // A direct thread is staff-to-staff only - never to a client's login.
      if (await isClientUserDb(d.toUserId)) return { ok: false, error: "Message a client from their client page." };
      sent = await sendTeamMessageDb(membership.orgId, principal.userId, d.toUserId, d.text, attachment, d.replyToId);
    } else {
      return { ok: false, error: "Pick a conversation." };
    }
    threadId = sent.threadId;
    messageId = sent.messageId;
    // The attachment's bytes count against the org's storage.
    if (attachment) await addStorageUsage(membership.orgId, attachment.bytes);
    // Live delivery (Supabase Realtime)  best-effort, dormant if not configured.
    const senderName = await getUserName(principal.userId);
    const replyTo = d.replyToId ? await quotedMessageDb(d.replyToId) : null;
    const msgPayload = {
      threadId: sent.threadId, id: sent.messageId, senderId: principal.userId, text: d.text, at: sent.createdAt, senderName,
      attachment: attachment ? { name: attachment.name, contentType: attachment.contentType, bytes: attachment.bytes } : undefined,
      replyTo,
    };
    await broadcastToThread(sent.threadId, msgPayload);
    // A brand-new direct thread: the recipient isn't subscribed to its channel yet,
    // so push them a `thread_added` carrying this first message  otherwise they'd
    // miss it until a reload. (Existing threads: they're already subscribed.)
    if (sent.created && d.toUserId) {
      await broadcastThreadAdded([d.toUserId], {
        id: sent.threadId, kind: "direct",
        otherUserId: principal.userId, otherName: senderName, otherRole: membership.teamRole ?? "counsellor",
        message: msgPayload,
      });
    }
    // Phase 34.2 - the doorbell: bell every other member (once per thread until
    // read) and, for anyone NOT online in Phila, ONE external "X sent you a
    // message on Phila" on their preferred channel. Runs after the response.
    const nudgeInput = { threadId: sent.threadId, orgId: me.orgId, senderUserId: me.userId, senderName, messageId: sent.messageId, senderKind: me.kind };
    after(() => nudgeThreadMembers(nudgeInput).catch(() => {}));
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: me.kind === "client" ? "client" : null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `team_message:${threadId ?? d.toUserId ?? "thread"}`,
    reason: me.kind === "client" ? "client_reply" : attachment ? "send_team_message_attachment" : "send_team_message",
  });
  return { ok: true, threadId, messageId };
}

/**
 * Phase 34.1 - the practice opens (or reopens) THE conversation with a client.
 * Admins / front desk: any client; a counsellor: their own caseload. Returns
 * the thread id so the caller can land on it. Audited.
 */
export async function startClientThread(raw: { clientId: string }): Promise<{ ok: true; threadId: string; created: boolean } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["org_admin", "front_desk", "counsellor"]);
  const clientId = String(raw?.clientId ?? "");
  if (!clientId) return { ok: false, error: "Invalid request." };
  if (!isDb()) return { ok: false, error: "Client messaging needs the database." };
  const res = await findOrCreateClientThreadDb(membership.orgId, principal.userId, membership.teamRole, clientId);
  if (!res) return { ok: false, error: "You can only message clients on your caseload." };
  if (res.created) {
    await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `client_thread:${res.threadId}`, reason: "open_client_thread" });
  }
  return { ok: true, threadId: res.threadId, created: res.created };
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
  const v = validateUpload({ contentType: parsed.data.contentType, bytes: parsed.data.bytes, name: parsed.data.name });
  if (!v.ok) return v;
  if (!isDb()) return { ok: false, error: "Attachments aren't available in this demo." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Attachments aren't switched on yet." };
  const used = await currentStorageBytes(membership.orgId);
  if (used + parsed.data.bytes > await orgStorageLimitBytes(membership.orgId))
    return { ok: false, error: "Your practice's storage is full  free up space or upgrade." };

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

/** A short-TTL signed URL to open a chat attachment  members only. */
export async function signChatAttachment(raw: { messageId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const messageId = String(raw?.messageId ?? "");
  if (!messageId) return { ok: false, error: "Not found." };
  const acc = await getAttachmentAccess(messageId, principal.userId);
  if (!acc) return { ok: false, error: "That file isn't available to open." };
  const storage = await getStorageProvider(acc.backend);
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
  await broadcastThreadAdded(parsed.data.memberUserIds, { id: threadId, kind: "group", title: parsed.data.title, memberCount: parsed.data.memberUserIds.length + 1 });
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
  const principal = await requireMessagingPrincipal();
  if (isDb() && threadId && !threadId.startsWith("local_")) await markThreadReadDb(threadId, principal.userId);
  return { ok: true };
}

const editInput = z.object({ messageId: z.string().min(1), text: z.string().trim().min(1, "Message can't be empty.").max(4000) });
export async function editMessage(raw: z.infer<typeof editInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireMessagingPrincipal();
  const principal = { userId: me.userId };
  const membership = { orgId: me.orgId, teamRole: me.kind === "staff" ? me.teamRole : null };
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
  const me = await requireMessagingPrincipal();
  const principal = { userId: me.userId };
  const membership = { orgId: me.orgId, teamRole: me.kind === "staff" ? me.teamRole : null };
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

/**
 * Batch 2u - re-read this person's threads. The chat prefers live delivery over
 * Supabase Realtime, but that depends on an external service being reachable;
 * when it is not, the view polls this instead of leaving people to press refresh
 * to see a reply. Same data the page loads, same permissions.
 */
export async function refreshThreads(): Promise<{ ok: true; threads: TeamThread[] } | { ok: false; error: string }> {
  const me = await requireMessagingPrincipal();
  if (me.kind === "client") {
    if (!isDb()) return { ok: true, threads: [] };
    const threads = await runForOrg(me.orgId, () => listTeamThreadsDb(me.userId, me.orgId));
    return { ok: true, threads: threads.filter((t) => t.kind === "client") };
  }
  const provider = await getDataProvider();
  const threads = await provider.listTeamThreads(me.userId, me.orgId);
  return { ok: true, threads };
}

/* ── Batch 4g - reactions + group management ────────────────────────────── */

const reactionInput = z.object({ messageId: z.string().min(1), emoji: z.string().min(1).max(16) });
/** Toggle my emoji reaction on a message (members only). Live for the thread. */
export async function toggleReaction(raw: z.infer<typeof reactionInput>): Promise<{ ok: true; added: boolean } | { ok: false; error: string }> {
  const me = await requireMessagingPrincipal();
  const principal = { userId: me.userId };
  const membership = { orgId: me.orgId };
  const parsed = reactionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid reaction." };
  if (!isDb() || parsed.data.messageId.startsWith("local_")) return { ok: true, added: true };
  const res = await toggleReactionDb(membership.orgId, principal.userId, parsed.data.messageId, parsed.data.emoji);
  if (!res) return { ok: false, error: "That message isn't available." };
  await broadcastReaction(res.threadId, { messageId: parsed.data.messageId, emoji: parsed.data.emoji, userId: principal.userId, added: res.added });
  return { ok: true, added: res.added };
}

const renameInput = z.object({ threadId: z.string().min(1), title: z.string().trim().min(2, "Give the group a name.").max(60) });
/** Rename a group - its creator or an org admin. Live for every member; audited. */
export async function renameGroup(raw: z.infer<typeof renameInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = renameInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the name." };
  if (!isDb()) return { ok: false, error: "Groups need the database." };
  const can = await canManageGroupDb(membership.orgId, parsed.data.threadId, principal.userId, membership.teamRole);
  if (!can.ok) return can;
  await renameGroupDb(parsed.data.threadId, parsed.data.title);
  await broadcastThreadUpdated(parsed.data.threadId, { title: parsed.data.title });
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_group:${parsed.data.threadId}`, reason: "rename_group" });
  return { ok: true };
}

const addInput = z.object({ threadId: z.string().min(1), memberUserIds: z.array(z.string().min(1)).min(1, "Pick at least one teammate.") });
/** Add teammates to a group - creator or org admin. New members get the thread live. */
export async function addGroupMembers(raw: z.infer<typeof addInput>): Promise<{ ok: true; members: { userId: string; name: string; role: string }[] } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = addInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the members." };
  if (!isDb()) return { ok: false, error: "Groups need the database." };
  const can = await canManageGroupDb(membership.orgId, parsed.data.threadId, principal.userId, membership.teamRole);
  if (!can.ok) return can;
  const added = await addGroupMembersDb(membership.orgId, parsed.data.threadId, parsed.data.memberUserIds);
  const members = await threadMembersDb(membership.orgId, parsed.data.threadId);
  if (added.length > 0) {
    await broadcastThreadAdded(added, { id: parsed.data.threadId, kind: "group", title: can.title, memberCount: members.length });
    await broadcastThreadUpdated(parsed.data.threadId, { members, memberCount: members.length });
    await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_group:${parsed.data.threadId}`, reason: `add_members_${added.length}` });
  }
  return { ok: true, members };
}

const removeInput = z.object({ threadId: z.string().min(1), userId: z.string().min(1) });
/** Remove a member - creator or org admin (the creator can't be removed; they leave). */
export async function removeGroupMember(raw: z.infer<typeof removeInput>): Promise<{ ok: true; members: { userId: string; name: string; role: string }[] } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = removeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (!isDb()) return { ok: false, error: "Groups need the database." };
  if (parsed.data.userId === principal.userId) return { ok: false, error: "Use Leave group to remove yourself." };
  const can = await canManageGroupDb(membership.orgId, parsed.data.threadId, principal.userId, membership.teamRole);
  if (!can.ok) return can;
  const removed = await removeGroupMemberDb(membership.orgId, parsed.data.threadId, parsed.data.userId);
  const members = await threadMembersDb(membership.orgId, parsed.data.threadId);
  if (removed) {
    await broadcastThreadRemoved([parsed.data.userId], parsed.data.threadId);
    await broadcastThreadUpdated(parsed.data.threadId, { members, memberCount: members.length });
    await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_group:${parsed.data.threadId}`, reason: "remove_member" });
  }
  return { ok: true, members };
}

/** Leave a group I'm in. Anyone can leave; the group lives on for the others. */
export async function leaveGroup(raw: { threadId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const threadId = String(raw?.threadId ?? "");
  if (!threadId) return { ok: false, error: "Invalid request." };
  if (!isDb()) return { ok: false, error: "Groups need the database." };
  if (!(await groupMembershipDb(membership.orgId, threadId, principal.userId))) return { ok: false, error: "You're not in that group." };
  await removeGroupMemberDb(membership.orgId, threadId, principal.userId);
  const members = await threadMembersDb(membership.orgId, threadId);
  await broadcastThreadUpdated(threadId, { members, memberCount: members.length });
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `team_group:${threadId}`, reason: "leave_group" });
  return { ok: true };
}
