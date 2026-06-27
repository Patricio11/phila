"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Send a message (mock). The composer keeps an optimistic copy; this validates
 * and audits the intent. **Nothing is delivered** in Part A  the WhatsApp /
 * channel rail turns on in Phase 12, behind this same shape. Honest by default.
 */
const input = z.object({
  clientId: z.string().min(1),
  text: z.string().min(1, "Write a message first.").max(4000),
});

export async function sendMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}/message`,
    reason: "send_message",
  });
  return { ok: true };
}
