import "server-only";
import { createHmac } from "node:crypto";

/**
 * Paystack (Phase 15) — the SA/Africa PSP behind credit purchases. Dormant until
 * PHILA_PAYSTACK_SECRET is set (test or live key); then the hub buys credits on a
 * real hosted checkout and the webhook tops up the balance. Amounts are in the
 * smallest unit (ZAR cents).
 */
export function paystackConfigured(): boolean {
  return Boolean(process.env.PHILA_PAYSTACK_SECRET);
}

export async function initTransaction(opts: { email: string; amountCents: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; authorizationUrl?: string; error?: string }> {
  const key = process.env.PHILA_PAYSTACK_SECRET;
  if (!key) return { ok: false, error: "Payments aren't switched on yet." };
  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: opts.email, amount: opts.amountCents, currency: "ZAR", reference: opts.reference, callback_url: opts.callbackUrl, metadata: opts.metadata }),
    });
    const json = (await res.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string } };
    if (!res.ok || !json.status || !json.data?.authorization_url) return { ok: false, error: json.message ?? "Could not start the payment." };
    return { ok: true, authorizationUrl: json.data.authorization_url };
  } catch {
    return { ok: false, error: "Couldn't reach the payment provider." };
  }
}

export async function verifyTransaction(reference: string): Promise<"success" | "failed" | "pending"> {
  const key = process.env.PHILA_PAYSTACK_SECRET;
  if (!key) return "pending";
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${key}` } });
    const json = (await res.json()) as { data?: { status?: string } };
    const s = json?.data?.status;
    return s === "success" ? "success" : s === "failed" ? "failed" : "pending";
  } catch {
    return "pending";
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.PHILA_PAYSTACK_SECRET;
  if (!key || !signature) return false;
  return createHmac("sha512", key).update(rawBody).digest("hex") === signature;
}
