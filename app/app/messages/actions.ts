"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Send an internal team message (mock)  staff-to-staff (hub ↔ counsellor,
 * counsellor ↔ counsellor). Validated + audited; the composer keeps an
 * optimistic copy. Client notices go out over SMS/WhatsApp, never here.
 * Phase 12 persists the thread and pushes an in-app notification.
 */
const input = z.object({
  toUserId: z.string().min(1),
  text: z.string().min(1, "Write a message first.").max(4000),
});

export async function sendTeamMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `team_message:${parsed.data.toUserId}`,
    reason: "send_team_message",
  });
  return { ok: true };
}
