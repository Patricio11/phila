import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { applyCredit } from "@/db/queries/messaging";
import type { CreditPack } from "@/lib/payments/packs";

export async function createPayment(orgId: string, pack: CreditPack, provider: string, providerRef: string): Promise<void> {
  await getDb().insert(payments).values({
    orgId, provider, providerRef,
    purpose: pack.channel === "sms" ? "credit_sms" : "credit_email",
    packId: pack.id, creditsAmount: pack.credits, amountCents: pack.priceCents,
    status: "pending", createdAt: new Date(),
  });
}

/**
 * Settle a payment from a webhook/callback. Idempotent: the first success tops up
 * the credit balance (the ledger entry is keyed on the payment ref); replays are
 * a no-op. Returns the credits granted (0 if already settled / unknown).
 */
export async function settlePayment(providerRef: string): Promise<{ credited: number; channel: "sms" | "email" | null }> {
  const db = getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.providerRef, providerRef)).limit(1);
  if (!pay) return { credited: 0, channel: null };
  const channel = pay.purpose === "credit_sms" ? "sms" : "email";
  if (pay.status === "paid") return { credited: 0, channel }; // already settled
  await db.update(payments).set({ status: "paid", paidAt: new Date() }).where(eq(payments.providerRef, providerRef));
  await applyCredit(pay.orgId, channel, pay.creditsAmount, "purchase", providerRef, `purchase_${providerRef}`);
  return { credited: pay.creditsAmount, channel };
}

export async function failPayment(providerRef: string): Promise<void> {
  await getDb().update(payments).set({ status: "failed" }).where(eq(payments.providerRef, providerRef));
}

export interface PaymentRow {
  providerRef: string;
  packId: string | null;
  creditsAmount: number;
  amountCents: number;
  status: string;
  channel: "sms" | "email";
  createdAt: string;
}

export async function listPayments(orgId: string, limit = 10): Promise<PaymentRow[]> {
  const rows = await getDb().select().from(payments).where(eq(payments.orgId, orgId)).orderBy(desc(payments.createdAt)).limit(limit);
  return rows.map((r) => ({
    providerRef: r.providerRef, packId: r.packId, creditsAmount: r.creditsAmount, amountCents: r.amountCents,
    status: r.status, channel: r.purpose === "credit_sms" ? "sms" : "email", createdAt: r.createdAt.toISOString(),
  }));
}
