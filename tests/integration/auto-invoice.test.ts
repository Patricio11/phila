import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W6.2 — an invoice is auto-raised when a priced session is booked, once, and only
 * when the org has auto-invoicing on. Exercised against a dedicated probe org.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { createInvoiceForBookingDb } = await import("@/db/queries/invoices");

const ORG = "org_inv_probe";

afterAll(async () => {
  await sql`DELETE FROM invoices WHERE org_id=${ORG}`;
  await sql`DELETE FROM clients WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("auto-invoice on booking", () => {
  it("raises one invoice for a priced session, honours the toggle and price", { timeout: 20_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, invoice_settings, created_at)
      VALUES (${ORG}, 'Invoice Probe', 'invoice-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
        ${JSON.stringify({ invoicePrefix: "IP", paymentTermsDays: 14, autoInvoiceOnBooking: true })}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET invoice_settings=EXCLUDED.invoice_settings`;
    await sql`DELETE FROM invoices WHERE org_id=${ORG}`;

    // A priced session → an unpaid invoice linked to the appointment.
    const r1 = await createInvoiceForBookingDb({ orgId: ORG, appointmentId: "appt_ip_1", clientId: "cl_ip_1", serviceName: "Individual counselling", amountCents: 45000, issuedAt: new Date("2026-07-01T09:00:00Z") });
    expect(r1?.id).toBeTruthy();
    const [inv] = await sql`SELECT number, status, amount_cents, appointment_id FROM invoices WHERE id=${r1!.id}`;
    expect(inv!.status).toBe("unpaid");
    expect(inv!.amount_cents).toBe(45000);
    expect(inv!.appointment_id).toBe("appt_ip_1");
    expect(inv!.number).toBe("IP-2026-0001");

    // Idempotent — booking the same session again doesn't double-bill.
    const r2 = await createInvoiceForBookingDb({ orgId: ORG, appointmentId: "appt_ip_1", clientId: "cl_ip_1", serviceName: "Individual counselling", amountCents: 45000, issuedAt: new Date("2026-07-01T09:00:00Z") });
    expect(r2?.id).toBe(r1!.id);
    const countRows = await sql`SELECT count(*)::int n FROM invoices WHERE org_id=${ORG}`;
    expect(countRows[0]!.n).toBe(1);

    // A free/unpriced session → no invoice.
    const free = await createInvoiceForBookingDb({ orgId: ORG, appointmentId: "appt_ip_free", clientId: "cl_ip_1", serviceName: "Community session", amountCents: 0, issuedAt: new Date("2026-07-01T09:00:00Z") });
    expect(free).toBeNull();

    // Sliding-scale fee (W7): a subsidised client is billed their rate, not the list price.
    await sql`INSERT INTO clients (id, org_id, name, province, fee_policy, created_at)
      VALUES ('cl_ip_sub', ${ORG}, 'Subsidised Client', 'Gauteng', '{"kind":"percentage","value":50}'::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET fee_policy=EXCLUDED.fee_policy`;
    const sub = await createInvoiceForBookingDb({ orgId: ORG, appointmentId: "appt_ip_sub", clientId: "cl_ip_sub", serviceName: "Individual counselling", amountCents: 45000, issuedAt: new Date("2026-07-01T09:00:00Z") });
    const [subInv] = await sql`SELECT amount_cents FROM invoices WHERE id=${sub!.id}`;
    expect(subInv!.amount_cents).toBe(22500); // 50% of R450

    // A waived (funded) client owes nothing → no invoice raised.
    await sql`UPDATE clients SET fee_policy='{"kind":"waived"}'::jsonb WHERE id='cl_ip_sub'`;
    const waived = await createInvoiceForBookingDb({ orgId: ORG, appointmentId: "appt_ip_waived", clientId: "cl_ip_sub", serviceName: "Individual counselling", amountCents: 45000, issuedAt: new Date("2026-07-01T09:00:00Z") });
    expect(waived).toBeNull();

    // Toggle off → no invoice even for a priced session.
    await sql`UPDATE orgs SET invoice_settings = jsonb_set(invoice_settings, '{autoInvoiceOnBooking}', 'false') WHERE id=${ORG}`;
    const off = await createInvoiceForBookingDb({ orgId: ORG, appointmentId: "appt_ip_2", clientId: "cl_ip_1", serviceName: "Individual counselling", amountCents: 45000, issuedAt: new Date("2026-07-01T09:00:00Z") });
    expect(off).toBeNull();
  });
});
