import { NextResponse } from "next/server";
import { verifyWebhookSignature, paystackSignatureValid } from "@/lib/payments/paystack";
import { settlePayment, failPayment, getPaymentByRef } from "@/db/queries/payments";
import { settleInvoicePayment } from "@/db/queries/invoice-payments";
import { settleSubscription } from "@/db/queries/subscriptions";
import { getOrgGatewaySecret } from "@/db/queries/org-gateway";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook (Phase 15). One endpoint, two payers: platform charges (credits
 * + subscriptions) are signed with Phila's key; an org's client-invoice charges are
 * signed with that ORG's key. We look the reference up first to pick the right
 * secret, verify, then settle — idempotently. The redirect-callback is the backstop.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ ok: true });

  const pay = await getPaymentByRef(reference);
  if (!pay) return NextResponse.json({ ok: true }); // unknown ref — nothing to do

  if (pay.purpose === "invoice") {
    const gw = await getOrgGatewaySecret(pay.orgId);
    if (!gw || !paystackSignatureValid(gw.secretKey, raw, sig)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
    if (event.event === "charge.success") await settleInvoicePayment(reference);
    return NextResponse.json({ ok: true });
  }

  // Platform charges (credit packs / subscriptions) — Phila's key.
  if (!(await verifyWebhookSignature(raw, sig))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  if (event.event === "charge.success") {
    if (pay.purpose === "subscription") await settleSubscription(reference);
    else await settlePayment(reference);
  } else if (event.event === "charge.failed") {
    await failPayment(reference);
  }
  return NextResponse.json({ ok: true });
}
