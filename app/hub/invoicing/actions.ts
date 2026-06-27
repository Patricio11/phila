"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Invoice actions (mock). Validated + audited; Phase 15 settles real payments
 * via the org's own PayShap/gateway and reconciles. Marking paid here is a
 * manual reconciliation entry — honest, and never invents a settlement.
 */
const markInput = z.object({ invoiceId: z.string().min(1) });

export async function markInvoicePaid(
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
    reason: "mark_paid",
  });
  return { ok: true };
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
