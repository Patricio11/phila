"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { sendTeamMessageDb, sendToThreadDb, createGroupThreadDb, markThreadReadDb, getUserName } from "@/db/queries/messages";
import { broadcastToThread } from "@/lib/messaging/realtime";

/**
 * Internal team messaging  staff-to-staff (hub ↔ counsellor, counsellor ↔
 * counsellor). Persisted to Neon (the source of truth); validated + audited. The
 * composer keeps an optimistic copy. Client notices go out over SMS/WhatsApp,
 * never here. Live delivery + presence (Supabase Realtime) layer on top.
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

const input = z
  .object({
    threadId: z.string().min(1).optional(),
    toUserId: z.string().min(1).optional(),
    text: z.string().trim().min(1, "Write a message first.").max(4000),
  })
  .refine((d) => d.threadId || d.toUserId, { message: "Pick a conversation." });

export async function sendTeamMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true; threadId?: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send." };
  const d = parsed.data;

  let threadId: string | undefined;
  if (isDb()) {
    let sent;
    if (d.threadId && !d.threadId.startsWith("local_")) {
      sent = await sendToThreadDb(membership.orgId, principal.userId, d.threadId, d.text);
      if (!sent) return { ok: false, error: "You're not in that conversation." };
    } else if (d.toUserId) {
      sent = await sendTeamMessageDb(membership.orgId, principal.userId, d.toUserId, d.text);
    } else {
      return { ok: false, error: "Pick a conversation." };
    }
    threadId = sent.threadId;
    // Live delivery (Supabase Realtime) — best-effort, dormant if not configured.
    const senderName = await getUserName(principal.userId);
    await broadcastToThread(sent.threadId, { threadId: sent.threadId, id: sent.messageId, senderId: principal.userId, text: d.text, at: sent.createdAt, senderName });
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `team_message:${threadId ?? d.toUserId ?? "thread"}`,
    reason: "send_team_message",
  });
  return { ok: true, threadId };
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
