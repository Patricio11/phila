import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices } from "@/db/schema";
import { getInvoiceSettingsDb } from "@/db/queries/settings";

/**
 * Auto-invoicing at booking (W6.2). When a priced session is booked, we raise an
 * unpaid invoice for it (linked to the appointment) so billing never slips. The client
 * can then pay it online through the org's gateway; settling flips it to paid. This is
 * a trusted system write (orgId is known from the appointment), so it uses the owner
 * connection — the same path booking itself uses.
 */
export async function createInvoiceForBookingDb(input: {
  orgId: string; appointmentId: string; clientId: string; serviceName: string; amountCents: number; issuedAt: Date;
}): Promise<{ id: string } | null> {
  // Never bill twice for the same session, or for a free/unpriced service.
  if (input.amountCents <= 0) return null;
  const db = getDb();
  const settings = await getInvoiceSettingsDb(input.orgId);
  if (!settings.autoInvoiceOnBooking) return null;

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
    amountCents: input.amountCents, status: "unpaid", issuedAt: input.issuedAt, dueAt, appointmentId: input.appointmentId,
  });
  return { id };
}
