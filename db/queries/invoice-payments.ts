import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices, orgs, payments } from "@/db/schema";
import { markInvoicePaid } from "@/db/queries/settings";
import { getOrgGatewayStatus } from "@/db/queries/org-gateway";

/** Client-facing invoice payments through the org's own gateway (Phase 15B). */

export interface PayableInvoice {
  id: string;
  number: string;
  serviceName: string;
  amountCents: number;
  status: string;
  dueAt: string;
  orgId: string;
  orgName: string;
  gatewayReady: boolean; // org gateway configured AND switched on
}

export async function getPayableInvoice(invoiceId: string): Promise<PayableInvoice | null> {
  const [inv] = await getDb().select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return null;
  const [org] = await getDb().select({ name: orgs.name }).from(orgs).where(eq(orgs.id, inv.orgId)).limit(1);
  const gw = await getOrgGatewayStatus(inv.orgId);
  return {
    id: inv.id, number: inv.number, serviceName: inv.serviceName, amountCents: inv.amountCents,
    status: inv.status, dueAt: inv.dueAt.toISOString(), orgId: inv.orgId,
    orgName: org?.name ?? "the practice", gatewayReady: gw.enabled && gw.configured,
  };
}

export async function recordInvoicePayment(orgId: string, invoiceId: string, provider: string, providerRef: string, amountCents: number): Promise<void> {
  await getDb().insert(payments).values({
    orgId, provider, providerRef, purpose: "invoice", invoiceId, amountCents,
    status: "pending", createdAt: new Date(),
  });
}

/** Idempotent: the first success marks the invoice paid; replays are a no-op. */
export async function settleInvoicePayment(providerRef: string): Promise<{ paid: boolean; invoiceId: string | null }> {
  const db = getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.providerRef, providerRef)).limit(1);
  if (!pay || pay.purpose !== "invoice" || !pay.invoiceId) return { paid: false, invoiceId: pay?.invoiceId ?? null };
  if (pay.status === "paid") return { paid: false, invoiceId: pay.invoiceId };
  await db.update(payments).set({ status: "paid", paidAt: new Date() }).where(eq(payments.providerRef, providerRef));
  await markInvoicePaid(pay.invoiceId);
  return { paid: true, invoiceId: pay.invoiceId };
}
