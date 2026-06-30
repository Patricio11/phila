"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { sendTeamMessageDb, markThreadReadDb } from "@/db/queries/messages";

/**
 * Internal team messaging  staff-to-staff (hub ↔ counsellor, counsellor ↔
 * counsellor). Persisted to Neon (the source of truth); validated + audited. The
 * composer keeps an optimistic copy. Client notices go out over SMS/WhatsApp,
 * never here. Live delivery + presence (Supabase Realtime) layer on top.
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

const input = z.object({
  toUserId: z.string().min(1),
  text: z.string().trim().min(1, "Write a message first.").max(4000),
});

export async function sendTeamMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true; threadId?: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send." };

  let threadId: string | undefined;
  if (isDb()) {
    const sent = await sendTeamMessageDb(membership.orgId, principal.userId, parsed.data.toUserId, parsed.data.text);
    threadId = sent.threadId;
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `team_message:${parsed.data.toUserId}`,
    reason: "send_team_message",
  });
  return { ok: true, threadId };
}

/** Clear unread for a thread (move the read cursor). */
export async function markThreadRead(threadId: string): Promise<{ ok: boolean }> {
  const { principal } = await requireOrg();
  if (isDb() && threadId && !threadId.startsWith("local_")) await markThreadReadDb(threadId, principal.userId);
  return { ok: true };
}
