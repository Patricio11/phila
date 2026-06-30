import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { settlePayment, failPayment } from "@/db/queries/payments";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook (Phase 15.1). A signed `charge.success` settles the matching
 * payment and tops up the org's credit balance (idempotent). The redirect-back
 * callback also verifies, so a top-up never depends on a single delivery.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const reference = event.data?.reference;
  if (reference) {
    if (event.event === "charge.success") await settlePayment(reference);
    else if (event.event === "charge.failed") await failPayment(reference);
  }
  return NextResponse.json({ ok: true });
}
