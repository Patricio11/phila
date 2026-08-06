import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices, clients, appointments, services } from "@/db/schema";
import { getInvoiceSettingsDb } from "@/db/queries/settings";
import { effectiveFeeCents, type FeePolicy } from "@/lib/billing/fees";

/**
 * Auto-invoicing at booking (W6.2). When a priced session is booked, we raise an
 * unpaid invoice for it (linked to the appointment) so billing never slips. The client
 * can then pay it online through the org's gateway; settling flips it to paid. This is
 * a trusted system write (orgId is known from the appointment), so it uses the owner
 * connection - the same path booking itself uses.
 */
export async function createInvoiceForBookingDb(input: {
  orgId: string; appointmentId: string; clientId: string; serviceName: string; amountCents: number; issuedAt: Date;
}): Promise<{ id: string } | null> {
  const db = getDb();
  const settings = await getInvoiceSettingsDb(input.orgId);
  if (!settings.autoInvoiceOnBooking) return null;

  // Apply the client's sliding-scale fee to the service list price (W7). A waived /
  // fully-subsidised client owes nothing → no invoice; a free service → no invoice.
  const [c] = await db.select({ fee: clients.feePolicy }).from(clients).where(eq(clients.id, input.clientId)).limit(1);
  const amountCents = effectiveFeeCents(input.amountCents, (c?.fee as FeePolicy | null) ?? null);
  if (amountCents <= 0) return null;

  const existing = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.appointmentId, input.appointmentId)).limit(1);
  if (existing.length) return { id: existing[0]!.id };

  const year = input.issuedAt.getFullYear();
  // Next number in the org's series for the year: PREFIX-YEAR-NNNN.
  const countRows = await db.select({ n: sql<number>`count(*)::int` }).from(invoices)
    .where(and(eq(invoices.orgId, input.orgId), sql`extract(year from ${invoices.issuedAt}) = ${year}`));
  const number = `${settings.invoicePrefix}-${year}-${String((countRows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  const dueAt = new Date(input.issuedAt.getTime() + settings.paymentTermsDays * 86_400_000);

  const id = `inv_${randomUUID()}`;
  await db.insert(invoices).values({
    id, clientId: input.clientId, orgId: input.orgId, number, serviceName: input.serviceName,
    amountCents, status: "unpaid", issuedAt: input.issuedAt, dueAt, appointmentId: input.appointmentId,
  });
  return { id };
}

/**
 * Feedback batch 2 - make sure a session HAS its invoice. The natural billing
 * moment is completion (recurring members bill per occurrence; anything the
 * booking path missed gets caught here). Honest outcomes, never a silent skip.
 */
export async function ensureInvoiceForAppointmentDb(
  orgId: string,
  appointmentId: string,
  issuedAt: Date,
  opts?: { respectAutoToggle?: boolean },
): Promise<{ outcome: "created" | "exists" | "no_price" | "waived" | "auto_off" | "not_found"; id?: string }> {
  const db = getDb();
  const [row] = await db
    .select({ a: appointments, priceCents: services.priceCents, serviceName: services.name })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)))
    .limit(1);
  if (!row) return { outcome: "not_found" };

  const existing = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.appointmentId, appointmentId)).limit(1);
  if (existing.length) return { outcome: "exists", id: existing[0]!.id };
  if (row.priceCents == null || row.priceCents <= 0) return { outcome: "no_price" };

  const settings = await getInvoiceSettingsDb(orgId);
  const [c] = await db.select({ fee: clients.feePolicy }).from(clients).where(eq(clients.id, row.a.clientId)).limit(1);
  const amountCents = effectiveFeeCents(row.priceCents, (c?.fee as FeePolicy | null) ?? null);
  if (amountCents <= 0) return { outcome: "waived" };
  // Auto-invoicing off is a deliberate org choice for the AUTOMATIC paths (the
  // completion hook); the explicit "Generate invoice" button still goes through.
  if (opts?.respectAutoToggle && !settings.autoInvoiceOnBooking) return { outcome: "auto_off" };

  const year = issuedAt.getFullYear();
  const countRows = await db.select({ n: sql<number>`count(*)::int` }).from(invoices)
    .where(and(eq(invoices.orgId, orgId), sql`extract(year from ${invoices.issuedAt}) = ${year}`));
  const number = `${settings.invoicePrefix}-${year}-${String((countRows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
  const dueAt = new Date(issuedAt.getTime() + settings.paymentTermsDays * 86_400_000);

  const id = `inv_${randomUUID()}`;
  await db.insert(invoices).values({
    id, clientId: row.a.clientId, orgId, number, serviceName: row.serviceName ?? "Session",
    amountCents, status: "unpaid", issuedAt, dueAt, appointmentId,
  });
  return { outcome: "created", id };
}

/** The invoice attached to one appointment (for the detail modal). */
export async function invoiceForAppointmentDb(orgId: string, appointmentId: string): Promise<{ id: string; number: string; amountCents: number; status: string; dueAt: string } | null> {
  const [inv] = await getDb().select().from(invoices)
    .where(and(eq(invoices.appointmentId, appointmentId), eq(invoices.orgId, orgId))).limit(1);
  return inv ? { id: inv.id, number: inv.number, amountCents: inv.amountCents, status: inv.status, dueAt: inv.dueAt.toISOString() } : null;
}

/**
 * Set-based backfill: one pass, one bulk insert - 190 missing invoices land in
 * seconds, numbered sequentially in the org's series. Waived fees are skipped.
 */
export async function backfillInvoicesDb(orgId: string, issuedAt: Date): Promise<{ created: number; skipped: number }> {
  const db = getDb();
  const rows = await listUninvoicedCompletedDb(orgId);
  if (rows.length === 0) return { created: 0, skipped: 0 };

  const settings = await getInvoiceSettingsDb(orgId);
  const year = issuedAt.getFullYear();
  const countRows = await db.select({ n: sql<number>`count(*)::int` }).from(invoices)
    .where(and(eq(invoices.orgId, orgId), sql`extract(year from ${invoices.issuedAt}) = ${year}`));
  let seq = (countRows[0]?.n ?? 0) + 1;
  const dueAt = new Date(issuedAt.getTime() + settings.paymentTermsDays * 86_400_000);

  // Client fee policies + client ids in one sweep.
  const apptIds = rows.map((r) => r.appointmentId);
  const apptRows = await db.select({ id: appointments.id, clientId: appointments.clientId }).from(appointments)
    .where(inArray(appointments.id, apptIds));
  const clientOf = new Map(apptRows.map((a) => [a.id, a.clientId]));
  const feeRows = await db.select({ id: clients.id, fee: clients.feePolicy }).from(clients)
    .where(inArray(clients.id, [...new Set(apptRows.map((a) => a.clientId))]));
  const feeOf = new Map(feeRows.map((c) => [c.id, c.fee as FeePolicy | null]));

  const values: (typeof invoices.$inferInsert)[] = [];
  let skipped = 0;
  for (const r of rows) {
    const clientId = clientOf.get(r.appointmentId);
    if (!clientId) { skipped += 1; continue; }
    const amountCents = effectiveFeeCents(r.priceCents, feeOf.get(clientId) ?? null);
    if (amountCents <= 0) { skipped += 1; continue; }
    values.push({
      id: `inv_${randomUUID()}`, clientId, orgId,
      number: `${settings.invoicePrefix}-${year}-${String(seq++).padStart(4, "0")}`,
      serviceName: r.serviceName, amountCents, status: "unpaid",
      issuedAt, dueAt, appointmentId: r.appointmentId,
    });
  }
  for (let i = 0; i < values.length; i += 100) {
    await db.insert(invoices).values(values.slice(i, i + 100));
  }
  return { created: values.length, skipped };
}

/** Completed sessions that never got an invoice - the backfill list (priced services only). */
export async function listUninvoicedCompletedDb(orgId: string): Promise<{ appointmentId: string; clientName: string; serviceName: string; startsAt: string; priceCents: number }[]> {
  const db = getDb();
  const rows = await db
    .select({ a: appointments, clientName: clients.name, serviceName: services.name, priceCents: services.priceCents })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(invoices, eq(invoices.appointmentId, appointments.id))
    .where(and(
      eq(appointments.orgId, orgId),
      inArray(appointments.state, ["completed", "discharged"]),
      isNull(invoices.id),
      sql`${services.priceCents} > 0`,
    ));
  return rows
    .map((r) => ({
      appointmentId: r.a.id, clientName: r.clientName ?? "Client", serviceName: r.serviceName ?? "Session",
      startsAt: r.a.startsAt.toISOString(), priceCents: r.priceCents ?? 0,
    }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}
