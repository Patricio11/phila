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

/* ── Batch 3k - edit, cancel, reinstate ──────────────────────────────────── */

const editInput = z.object({
  invoiceId: z.string().min(1),
  serviceName: z.string().trim().min(2, "Name the service.").max(160),
  amountRands: z.number().min(0).max(1_000_000),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(600, "Keep the note under 600 characters.").optional(),
});

export async function updateInvoice(raw: z.infer<typeof editInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = editInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the invoice details." };
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };
  const d = parsed.data;
  const { updateInvoiceDb } = await import("@/db/queries/invoices");
  const res = await updateInvoiceDb(membership.orgId, d.invoiceId, {
    serviceName: d.serviceName,
    amountCents: Math.round(d.amountRands * 100),
    dueAt: new Date(`${d.dueAt}T17:00:00+02:00`),
    notes: d.notes === undefined ? undefined : (d.notes.trim() || null),
  });
  if (!res.ok) return res;
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `invoice:${d.invoiceId}`,
    reason: "edit_invoice",
  });
  revalidatePath("/hub/invoicing");
  return { ok: true };
}

export async function setInvoiceCancelled(raw: { invoiceId: string; cancelled: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const invoiceId = String(raw?.invoiceId ?? "");
  const cancelled = Boolean(raw?.cancelled);
  if (!invoiceId) return { ok: false, error: "Not found." };
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };
  const { setInvoiceCancelledDb } = await import("@/db/queries/invoices");
  const res = await setInvoiceCancelledDb(membership.orgId, invoiceId, cancelled);
  if (!res.ok) return res;
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `invoice:${invoiceId}`,
    reason: cancelled ? "cancel_invoice" : "reinstate_invoice",
  });
  revalidatePath("/hub/invoicing");
  return { ok: true };
}

/**
 * Batch 3l - the builder finally creates a REAL invoice. One serviceName line
 * (the builder's lines joined), gross amount, optional linked session whose
 * APT reference then prints on the A4. Number is allocated server-side.
 */
const createInput = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().min(1).nullable(),
  serviceName: z.string().trim().min(2, "Describe what this invoice bills.").max(160),
  amountRands: z.number().min(0.01, "The invoice total must be more than zero.").max(1_000_000),
  /** Batch 4j - the note printed on the sheet (starts from the org's default). */
  notes: z.string().trim().max(600, "Keep the note under 600 characters.").optional(),
});
export async function createInvoice(
  raw: z.infer<typeof createInput>,
): Promise<{ ok: true; id: string; number: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the invoice details." };
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };
  const d = parsed.data;
  const { createManualInvoiceDb } = await import("@/db/queries/invoices");
  const res = await createManualInvoiceDb({
    orgId: membership.orgId,
    clientId: d.clientId,
    appointmentId: d.appointmentId,
    serviceName: d.serviceName,
    amountCents: Math.round(d.amountRands * 100),
    issuedAt: new Date(),
    notes: d.notes?.trim() || null,
  });
  if (!res.ok) return res;
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `invoice:${res.id}`,
    reason: "create_invoice",
  });
  revalidatePath("/hub/invoicing");
  return res;
}
