import "server-only";
import { createHmac } from "node:crypto";
import { getPaystackSecret } from "@/db/queries/platform-integrations";

/**
 * Paystack (Phase 15) — the SA/Africa PSP behind credit purchases + platform
 * subscriptions. The secret key is configured + switched on by the super-admin in
 * /admin/integrations (encrypted at rest), NOT an env var. Dormant until then.
 * Amounts are in the smallest unit (ZAR cents).
 */
export async function paystackConfigured(): Promise<boolean> {
  return Boolean(await getPaystackSecret());
}

export async function initTransaction(opts: { email: string; amountCents: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; authorizationUrl?: string; error?: string }> {
  const key = await getPaystackSecret();
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
  const key = await getPaystackSecret();
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

export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const key = await getPaystackSecret();
  if (!key || !signature) return false;
  return createHmac("sha512", key).update(rawBody).digest("hex") === signature;
}

/** Test a candidate key against Paystack — used by the admin "Test connection" button. */
export async function testPaystackKey(secretKey: string): Promise<{ ok: boolean; detail: string }> {
  if (!secretKey) return { ok: false, detail: "Enter a secret key first." };
  try {
    const res = await fetch("https://api.paystack.co/balance", { headers: { Authorization: `Bearer ${secretKey}` } });
    const json = (await res.json()) as { status?: boolean; message?: string; data?: Array<{ currency?: string }> };
    if (res.ok && json.status) {
      const cur = json.data?.[0]?.currency;
      return { ok: true, detail: cur ? `Connected to Paystack (${cur} account).` : "Connected to Paystack." };
    }
    return { ok: false, detail: json.message ?? "Paystack rejected that key." };
  } catch {
    return { ok: false, detail: "Couldn't reach Paystack  check the key and try again." };
  }
}
