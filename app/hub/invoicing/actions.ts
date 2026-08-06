"use server";

import { z } from "zod";
import { requireHub, requireOrg } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import { logAccess } from "@/lib/audit";
import { markInvoicePaid as persistMarkPaid } from "@/db/queries/settings";
import { invoicePayPath } from "@/lib/payments/invoice-link";
import { getPayableInvoice } from "@/db/queries/invoice-payments";

/**
 * Invoice actions - real. Marking paid is a manual reconciliation entry (honest,
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
 * Honest return - the UI says exactly what went out.
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
    // In-app (the bell) - always on, no external dependency.
    const { notifyClientUser } = await import("@/db/queries/notifications");
    await notifyClientUser(row.clientId, membership.orgId, {
      kind: "invoice_reminder",
      title: `Invoice ${inv.number} is due`,
      body: `${inv.serviceName} · ${amount} · due ${due}${payUrl ? " - you can pay online from your invoices." : ""}`,
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

/* ---- Feedback batch 2 - every session carries its invoice ---- */

/** The invoice linked to an appointment (the detail modal shows it inline). */
export async function getAppointmentInvoice(
  raw: { appointmentId: string },
): Promise<{ ok: true; invoice: { id: string; number: string; amountCents: number; status: string; dueAt: string } | null } | { ok: false; error: string }> {
  const { membership } = await requireOrg(["org_admin", "counsellor", "front_desk", "finance"]);
  if (!raw?.appointmentId) return { ok: false, error: "Invalid request" };
  if (process.env.DATA_PROVIDER !== "db") return { ok: true, invoice: null };
  const { invoiceForAppointmentDb } = await import("@/db/queries/invoices");
  const invoice = await invoiceForAppointmentDb(membership.orgId, raw.appointmentId);
  return { ok: true, invoice };
}

/** Explicitly raise the invoice for one session (works even when auto-invoice is off). */
export async function generateAppointmentInvoice(
  raw: { appointmentId: string },
): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["org_admin", "counsellor", "front_desk", "finance"]);
  if (!raw?.appointmentId) return { ok: false, error: "Invalid request" };
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };

  const { ensureInvoiceForAppointmentDb, invoiceForAppointmentDb } = await import("@/db/queries/invoices");
  const { now: clockNow } = await import("@/lib/clock");
  const res = await ensureInvoiceForAppointmentDb(membership.orgId, raw.appointmentId, new Date(clockNow()));
  if (res.outcome === "not_found") return { ok: false, error: "That session couldn't be found." };
  if (res.outcome === "no_price") return { ok: false, error: "This service has no price - set one under Services first." };
  if (res.outcome === "waived") return { ok: false, error: "This client's fee is waived - nothing to invoice." };

  const inv = await invoiceForAppointmentDb(membership.orgId, raw.appointmentId);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${raw.appointmentId}/invoice`,
    reason: res.outcome === "exists" ? "invoice_already_exists" : "generate_invoice",
  });
  return { ok: true, number: inv?.number ?? "" };
}

/** Completed sessions with no invoice - the honest backfill list for the banner. */
export async function getUninvoicedCompleted(): Promise<
  { ok: true; rows: { appointmentId: string; clientName: string; serviceName: string; startsAt: string; priceCents: number }[] } | { ok: false; error: string }
> {
  const { membership } = await requireHub();
  if (process.env.DATA_PROVIDER !== "db") return { ok: true, rows: [] };
  const { listUninvoicedCompletedDb } = await import("@/db/queries/invoices");
  return { ok: true, rows: await listUninvoicedCompletedDb(membership.orgId) };
}

/** One click: raise invoices for every completed-but-uninvoiced session. Audited. */
export async function backfillInvoices(): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };

  const { backfillInvoicesDb } = await import("@/db/queries/invoices");
  const { now: clockNow } = await import("@/lib/clock");
  const { created, skipped } = await backfillInvoicesDb(membership.orgId, new Date(clockNow()));

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/invoices/backfill`,
    reason: `backfill_invoices:${created}c_${skipped}s`,
  });
  revalidatePath("/hub/invoicing");
  return { ok: true, created, skipped };
}
