"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { applyCredit } from "@/db/queries/messaging";
import { reviewOnboardingDocDb, approveOrgDb, sendBackOnboardingDb, getOrgAdminContactDb, getAdminOnboardingDocKeyDb } from "@/db/queries/platform";
import { getStorageProvider } from "@/lib/storage";
import { sendPlatformEmail } from "@/lib/email/platform-email";
import { approvalEmail, actionNeededEmail } from "@/lib/email/templates";

const isDb = () => process.env.DATA_PROVIDER === "db";
const appUrl = () => process.env.BETTER_AUTH_URL ?? "https://philasa.com";

/**
 * Manually grant notification credits to an org (Phase 12.5)  the bridge until
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
  note: z.string().trim().max(300).optional(),
});

export async function reviewOnboardingDoc(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  if (isDb()) {
    const res = await reviewOnboardingDocDb(parsed.data.orgId, parsed.data.requirementId, parsed.data.decision, parsed.data.note);
    if (!res.ok) return { ok: false, error: "That document is not awaiting review." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: parsed.data.orgId,
    target: `org:${parsed.data.orgId}/doc:${parsed.data.requirementId}`,
    reason: parsed.data.decision === "verify" ? "verify_document" : "reject_document",
  });
  revalidatePath(`/admin/orgs/${parsed.data.orgId}`);
  return { ok: true };
}

const decisionInput = z.object({ orgId: z.string().min(1), reason: z.string().trim().max(300).optional() });

/** Approve a practice's verification and email the good news. */
export async function approveOrg(raw: z.infer<typeof decisionInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = decisionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (!isDb()) return { ok: true };

  const res = await approveOrgDb(parsed.data.orgId);
  if (!res.ok) return { ok: false, error: "That organisation could not be found." };

  const contact = await getOrgAdminContactDb(parsed.data.orgId);
  if (contact) {
    await sendPlatformEmail({ to: contact.email, ...approvalEmail({ name: contact.name, orgName: contact.orgName, loginUrl: `${appUrl()}/hub` }) });
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: parsed.data.orgId, target: `org:${parsed.data.orgId}`, reason: "approve_verification" });
  revalidatePath(`/admin/orgs/${parsed.data.orgId}`);
  revalidatePath("/admin/orgs");
  return { ok: true };
}

/** Send a practice's onboarding back for changes and email why. */
export async function sendBackOnboarding(raw: z.infer<typeof decisionInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = decisionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const reason = parsed.data.reason?.trim() || "Some details need another look.";
  if (!isDb()) return { ok: true };

  const res = await sendBackOnboardingDb(parsed.data.orgId);
  if (!res.ok) return { ok: false, error: "That organisation could not be found." };

  const contact = await getOrgAdminContactDb(parsed.data.orgId);
  if (contact) {
    await sendPlatformEmail({ to: contact.email, ...actionNeededEmail({ name: contact.name, orgName: contact.orgName, reason, onboardingUrl: `${appUrl()}/hub/verification` }) });
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: parsed.data.orgId, target: `org:${parsed.data.orgId}`, reason: "send_back_onboarding" });
  revalidatePath(`/admin/orgs/${parsed.data.orgId}`);
  revalidatePath("/admin/orgs");
  return { ok: true };
}

/** A signed URL to open one of an org's uploaded onboarding documents. */
export async function signAdminOnboardingDoc(raw: { orgId: string; requirementId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  if (!isDb()) return { ok: false, error: "Not available in this demo." };
  const key = await getAdminOnboardingDocKeyDb(String(raw?.orgId ?? ""), String(raw?.requirementId ?? ""));
  if (!key) return { ok: false, error: "Not found." };
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Storage isn't switched on." };
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: raw.orgId, target: `onboarding:${raw.requirementId}`, reason: "admin_review_download" });
  try {
    return { ok: true, url: await storage.signedDownloadUrl(key) };
  } catch {
    return { ok: false, error: "Could not open the document." };
  }
}
