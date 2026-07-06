"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { addCarePlanStepDb } from "@/db/queries/care-plans";
import { counsellorIdForUser } from "@/db/queries/session-notes";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Add a between-session step to a client's care plan. The counsellor sets gentle,
 * specific steps; the client ticks them off in their portal. Persisted to the
 * client's care plan (RLS rejects a client outside the caller's org); audited.
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
  let id = `step_${parsed.data.text.length}_${parsed.data.clientId}`;
  if (isDb()) {
    const cid = await counsellorIdForUser(membership.orgId, principal.userId);
    try {
      const res = await addCarePlanStepDb(membership.orgId, { clientId: parsed.data.clientId, authorCounsellorId: cid ?? principal.userId, text: parsed.data.text });
      id = res.id;
    } catch {
      return { ok: false, error: "That client isn't on your caseload." };
    }
  }
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}/care_step`,
    reason: "add_care_step",
  });
  return { ok: true, id };
}
