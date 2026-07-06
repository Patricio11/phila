import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getPaystackSecret } from "@/db/queries/platform-integrations";

/**
 * Paystack (Phase 15)  the SA/Africa PSP. Two surfaces, same primitives:
 *  • Platform (credits + plan billing) uses Phila's key, configured in
 *    /admin/integrations (getPaystackSecret).
 *  • Each org's OWN gateway (client invoices) uses the org's key (Phase 15B) so
 *    funds settle to the org. Those callers pass the key explicitly.
 * Keys are never env vars; all are encrypted at rest. Amounts are in ZAR cents.
 */

// ---- Core (explicit key) ----
export async function paystackInit(secretKey: string, opts: { email: string; amountCents: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; authorizationUrl?: string; error?: string }> {
  if (!secretKey) return { ok: false, error: "Payments aren't switched on yet." };
  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: opts.email, amount: opts.amountCents, currency: "ZAR", reference: opts.reference, callback_url: opts.callbackUrl, metadata: opts.metadata }),
    });
    const json = (await res.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string } };
    if (!res.ok || !json.status || !json.data?.authorization_url) return { ok: false, error: json.message ?? "Could not start the payment." };
    return { ok: true, authorizationUrl: json.data.authorization_url };
  } catch {
    return { ok: false, error: "Couldn't reach the payment provider." };
  }
}

export async function paystackVerify(secretKey: string, reference: string): Promise<"success" | "failed" | "pending"> {
  if (!secretKey) return "pending";
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
    const json = (await res.json()) as { data?: { status?: string } };
    const s = json?.data?.status;
    return s === "success" ? "success" : s === "failed" ? "failed" : "pending";
  } catch {
    return "pending";
  }
}

export function paystackSignatureValid(secretKey: string, rawBody: string, signature: string | null): boolean {
  if (!secretKey || !signature) return false;
  const want = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  // Constant-time compare so a forged signature can't be tuned byte-by-byte.
  if (want.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(want), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Test a candidate key against Paystack  used by both "Test connection" buttons. */
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

// ---- Platform wrappers (Phila's own key) ----
export async function paystackConfigured(): Promise<boolean> {
  return Boolean(await getPaystackSecret());
}
export async function initTransaction(opts: { email: string; amountCents: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }) {
  return paystackInit((await getPaystackSecret()) ?? "", opts);
}
export async function verifyTransaction(reference: string) {
  return paystackVerify((await getPaystackSecret()) ?? "", reference);
}
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  return paystackSignatureValid((await getPaystackSecret()) ?? "", rawBody, signature);
}
