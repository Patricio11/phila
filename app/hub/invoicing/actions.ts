"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { markInvoicePaid as persistMarkPaid } from "@/db/queries/settings";
import { invoicePayPath } from "@/lib/payments/invoice-link";
import { getPayableInvoice } from "@/db/queries/invoice-payments";

/**
 * Invoice actions — real. Marking paid is a manual reconciliation entry (honest,
 * never invents a settlement); reminders go out by platform email + in-app.
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

/**
 * Send a real invoice reminder: an email to the client (with the pay link when
 * the org's gateway is on) + an always-on in-app notification in their portal.
 * Honest return — the UI says exactly what went out.
 */
export async function sendInvoiceReminder(
  raw: z.infer<typeof markInput>,
): Promise<{ ok: true; emailed: boolean } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = markInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  let emailed = false;
  if (process.env.DATA_PROVIDER === "db") {
    const inv = await getPayableInvoice(parsed.data.invoiceId);
    if (!inv || inv.orgId !== membership.orgId) return { ok: false, error: "Invoice not found." };
    if (inv.status !== "unpaid") return { ok: false, error: "This invoice isn't outstanding." };

    const { getDb } = await import("@/db/client");
    const { clients, invoices } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await getDb()
      .select({ clientId: invoices.clientId, name: clients.name, email: clients.email })
      .from(invoices).leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.id, inv.id)).limit(1);
    if (!row) return { ok: false, error: "Invoice not found." };

    const amount = `R${(inv.amountCents / 100).toLocaleString("en-ZA")}`;
    const due = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(inv.dueAt));
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const payUrl = inv.gatewayReady ? `${base}${invoicePayPath(inv.id)}` : null;

    if (row.email) {
      const { sendPlatformEmail } = await import("@/lib/email/platform-email");
      const first = (row.name ?? "there").split(" ")[0];
      const text = `Hi ${first},\n\nA friendly reminder from ${inv.orgName}: invoice ${inv.number} (${inv.serviceName}, ${amount}) is due by ${due}.${payUrl ? `\n\nPay securely online: ${payUrl}` : "\n\nPlease settle it at your next visit, or contact the practice."}\n\nThank you.`;
      const res = await sendPlatformEmail({
        to: row.email,
        subject: `Reminder: invoice ${inv.number} from ${inv.orgName}`,
        html: text.replace(/\n/g, "<br/>"),
        text,
      });
      emailed = res.status === "sent";
    }
    // In-app (the bell) — always on, no external dependency.
    const { notifyClientUser } = await import("@/db/queries/notifications");
    await notifyClientUser(row.clientId, membership.orgId, {
      kind: "invoice_reminder",
      title: `Invoice ${inv.number} is due`,
      body: `${inv.serviceName} · ${amount} · due ${due}${payUrl ? " — you can pay online from your invoices." : ""}`,
      href: "/me/billing",
    });
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `invoice:${parsed.data.invoiceId}`,
    reason: "send_reminder",
  });
  return { ok: true, emailed };
}
