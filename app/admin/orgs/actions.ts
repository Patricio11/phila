"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Review a practice's onboarding document (mock). The platform admin verifies
 * or sends a document back. Validated + audited; Phase 10 persists the decision
 * and flips the org's verification state (which gates payouts + funder sharing).
 */
const input = z.object({
  orgId: z.string().min(1),
  requirementId: z.string().min(1),
  decision: z.enum(["verify", "reject"]),
});

export async function reviewOnboardingDoc(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: parsed.data.orgId,
    target: `org:${parsed.data.orgId}/doc:${parsed.data.requirementId}`,
    reason: parsed.data.decision === "verify" ? "verify_document" : "reject_document",
  });
  return { ok: true };
}
