"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Add a between-session step to a client's care plan (mock). The counsellor
 * sets gentle, specific steps; the client ticks them off in their portal.
 * Validated + audited; Phase 11 persists to the care plan + notifies the client.
 */
const input = z.object({
  clientId: z.string().min(1),
  text: z.string().min(3, "Write the step in a sentence or two.").max(200),
});

export async function addCarePlanStep(
  raw: z.infer<typeof input>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the step." };
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}/care_step`,
    reason: "add_care_step",
  });
  // A stable-enough id for the optimistic client (Phase 11 returns the real one).
  return { ok: true, id: `step_${parsed.data.text.length}_${parsed.data.clientId}` };
}
