"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * EAP companies (batch 2j) - employers who fund sessions for their staff.
 * Everything the company ever receives is aggregate-only; these actions are
 * the org-side management: create, edit, and record retainer payments.
 */

const companyInput = z.object({
  name: z.string().trim().min(2, "Give the company a name.").max(120),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Enter a valid email.").max(160).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  /** Negotiated per-session rate in cents; null = each service's list price. */
  sessionRateCents: z.number().int().min(0).max(10_000_00).nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function createCompany(
  raw: z.infer<typeof companyInput>,
): Promise<{ ok: true; id: string; bookingToken: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = companyInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the company details." };
  if (!isDb()) return { ok: false, error: "Not available in demo mode." };

  const { createCompanyDb } = await import("@/db/queries/companies");
  const d = parsed.data;
  const res = await createCompanyDb(membership.orgId, {
    name: d.name, contactName: d.contactName || null, contactEmail: d.contactEmail || null,
    contactPhone: d.contactPhone || null, sessionRateCents: d.sessionRateCents, notes: d.notes || null,
  });

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `company:${res.id}`,
    reason: "create_company",
  });
  revalidatePath("/hub/companies");
  return { ok: true, ...res };
}

const updateInput = companyInput.extend({ companyId: z.string().min(1) });

export async function updateCompany(
  raw: z.infer<typeof updateInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the company details." };
  if (!isDb()) return { ok: false, error: "Not available in demo mode." };

  const { updateCompanyDb } = await import("@/db/queries/companies");
  const d = parsed.data;
  const ok = await updateCompanyDb(membership.orgId, d.companyId, {
    name: d.name, contactName: d.contactName || null, contactEmail: d.contactEmail || null,
    contactPhone: d.contactPhone || null, sessionRateCents: d.sessionRateCents, notes: d.notes || null,
  });
  if (!ok) return { ok: false, error: "That company couldn't be found." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `company:${d.companyId}`,
    reason: "update_company",
  });
  revalidatePath("/hub/companies");
  revalidatePath(`/hub/companies/${d.companyId}`);
  return { ok: true };
}

const paymentInput = z.object({
  companyId: z.string().min(1),
  amountRands: z.number().int().min(1, "Enter the amount.").max(10_000_000),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function recordCompanyPayment(
  raw: z.infer<typeof paymentInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the payment." };
  if (!isDb()) return { ok: false, error: "Not available in demo mode." };

  const { recordCompanyPaymentDb } = await import("@/db/queries/companies");
  const ok = await recordCompanyPaymentDb(membership.orgId, parsed.data.companyId, parsed.data.amountRands * 100, parsed.data.note || null);
  if (!ok) return { ok: false, error: "That company couldn't be found." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `company:${parsed.data.companyId}/payment`,
    reason: `company_payment:${parsed.data.amountRands * 100}`,
  });
  revalidatePath(`/hub/companies/${parsed.data.companyId}`);
  revalidatePath("/hub/companies");
  return { ok: true };
}
