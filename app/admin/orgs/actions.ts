"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { applyCredit } from "@/db/queries/messaging";

/**
 * Manually grant notification credits to an org (Phase 12.5) — the bridge until
 * self-serve purchase lands in Phase 15.1. A super-admin tops up an org's SMS or
 * email balance; the credit_ledger keeps the audit trail.
 */
const grantInput = z.object({
  orgId: z.string().min(1),
  channel: z.enum(["sms", "email"]),
  amount: z.number().int().min(1).max(100000),
});

export async function grantMessagingCredits(
  raw: z.infer<typeof grantInput>,
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = grantInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the grant." };
  const { orgId, channel, amount } = parsed.data;
  const balance = await applyCredit(orgId, channel, amount, "grant", `admin:${principal.userId}`, `grant_${crypto.randomUUID()}`);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId, target: `org:${orgId}/credits:${channel}`, reason: `grant_${amount}` });
  return { ok: true, balance };
}

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
