"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { packById } from "@/lib/payments/packs";
import { paystackConfigured, initTransaction, verifyTransaction } from "@/lib/payments/paystack";
import { createPayment, settlePayment } from "@/db/queries/payments";

function ref(): string {
  return `phila_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

/**
 * Start a credit-pack purchase (Phase 15.1). Creates a pending payment + a Paystack
 * checkout; the hub is redirected to pay, then the webhook (or the callback verify)
 * tops up the balance idempotently.
 */
export async function startCreditPurchase(
  raw: { packId: string },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = z.object({ packId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const pack = packById(parsed.data.packId);
  if (!pack) return { ok: false, error: "That pack isn't available." };
  if (!paystackConfigured()) return { ok: false, error: "Self-serve top-up isn't switched on yet  Phila can add credits for you in the meantime." };

  const reference = ref();
  await createPayment(membership.orgId, pack, "paystack", reference);
  const callbackUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/hub/billing?ref=${reference}`;
  const init = await initTransaction({ email: principal.email, amountCents: pack.priceCents, reference, callbackUrl, metadata: { orgId: membership.orgId, packId: pack.id } });
  if (!init.ok || !init.authorizationUrl) return { ok: false, error: init.error ?? "Could not start the payment." };

  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/credit_purchase:${pack.id}`, reason: "start_credit_purchase" });
  return { ok: true, url: init.authorizationUrl };
}

/** Verify + settle on the redirect back from Paystack (the webhook is the backstop). */
export async function confirmCreditPurchase(reference: string): Promise<{ credited: number; channel: "sms" | "email" | null }> {
  await requireHub();
  if (!paystackConfigured()) return { credited: 0, channel: null };
  if ((await verifyTransaction(reference)) !== "success") return { credited: 0, channel: null };
  return settlePayment(reference);
}
