"use server";

import { z } from "zod";
import { verifyInvoiceToken } from "@/lib/payments/invoice-link";
import { getPayableInvoice, recordInvoicePayment, settleInvoicePayment } from "@/db/queries/invoice-payments";
import { getOrgGatewaySecret } from "@/db/queries/org-gateway";
import { paystackInit, paystackVerify } from "@/lib/payments/paystack";
import { logAccess } from "@/lib/audit";

function ref(): string {
  return `pinv_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

/** Start a client invoice payment through the ORG's own gateway (funds settle to the org). */
export async function startInvoicePayment(raw: { token: string; email: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = z.object({ token: z.string().min(4), email: z.string().email("Enter a valid email for your receipt.") }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  const invoiceId = verifyInvoiceToken(parsed.data.token);
  if (!invoiceId) return { ok: false, error: "This payment link is invalid." };
  const inv = await getPayableInvoice(invoiceId);
  if (!inv) return { ok: false, error: "We couldn't find that invoice." };
  if (inv.status === "paid") return { ok: false, error: "This invoice is already paid  thank you." };
  if (!inv.gatewayReady) return { ok: false, error: "This practice hasn't switched on online payments yet." };
  const gw = await getOrgGatewaySecret(inv.orgId);
  if (!gw) return { ok: false, error: "Payments are temporarily unavailable." };

  const reference = ref();
  await recordInvoicePayment(inv.orgId, inv.id, gw.provider, reference, inv.amountCents);
  const callbackUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/pay/${parsed.data.token}?ref=${reference}`;
  const init = await paystackInit(gw.secretKey, { email: parsed.data.email, amountCents: inv.amountCents, reference, callbackUrl, metadata: { orgId: inv.orgId, invoiceId: inv.id } });
  if (!init.ok || !init.authorizationUrl) return { ok: false, error: init.error ?? "Could not start the payment." };

  await logAccess({ action: "admin.action", actor: { userId: "public", platformRole: null, teamRole: null }, orgId: inv.orgId, target: `invoice:${inv.id}/pay`, reason: "invoice_pay_started" });
  return { ok: true, url: init.authorizationUrl };
}

/** Verify + settle on the redirect back (the webhook is the backstop). */
export async function confirmInvoicePayment(token: string, reference: string): Promise<{ paid: boolean }> {
  const invoiceId = verifyInvoiceToken(token);
  if (!invoiceId) return { paid: false };
  const inv = await getPayableInvoice(invoiceId);
  if (!inv) return { paid: false };
  const gw = await getOrgGatewaySecret(inv.orgId);
  if (!gw) return { paid: inv.status === "paid" };
  if ((await paystackVerify(gw.secretKey, reference)) !== "success") return { paid: inv.status === "paid" };
  const r = await settleInvoicePayment(reference);
  return { paid: r.paid || inv.status === "paid" };
}
