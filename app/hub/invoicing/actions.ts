"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { markInvoicePaid as persistMarkPaid } from "@/db/queries/settings";
import { invoicePayPath } from "@/lib/payments/invoice-link";
import { getPayableInvoice } from "@/db/queries/invoice-payments";

/**
 * Invoice actions (mock). Validated + audited; Phase 15 settles real payments
 * via the org's own PayShap/gateway and reconciles. Marking paid here is a
 * manual reconciliation entry  honest, and never invents a settlement.
 */
const markInput = z.object({ invoiceId: z.string().min(1) });

export async function markInvoicePaid(
  raw: z.infer<typeof markInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = markInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (process.env.DATA_PROVIDER === "db") await persistMarkPaid(parsed.data.invoiceId);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `invoice:${parsed.data.invoiceId}`,
    reason: "mark_paid",
  });
  return { ok: true };
}

/** A signed, shareable pay-link for an invoice (Phase 15B). Org-scoped. */
export async function getInvoicePayLink(
  raw: z.infer<typeof markInput>,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = markInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const inv = await getPayableInvoice(parsed.data.invoiceId);
  if (!inv || inv.orgId !== membership.orgId) return { ok: false, error: "Invoice not found." };
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return { ok: true, url: `${base}${invoicePayPath(parsed.data.invoiceId)}` };
}

export async function sendInvoiceReminder(
  raw: z.infer<typeof markInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = markInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `invoice:${parsed.data.invoiceId}`,
    reason: "send_reminder",
  });
  return { ok: true };
}
