import "server-only";
import { decryptField } from "@/lib/crypto";
import { getPlatformIntegration } from "@/db/queries/platform-integrations";

/**
 * Real-shaped transports, dormant-by-default. Each makes the actual provider call
 * when configured, and returns an HONEST result otherwise ("dormant"  never a
 * fake "sent"). WhatsApp uses the ORG's Meta Cloud API number; SMS (BulkSMS) and
 * email (Resend) use Phila's platform credentials  configured by the super-admin
 * in /admin/integrations (encrypted), falling back to env vars.
 */
export interface TransportResult {
  status: "sent" | "failed" | "dormant";
  providerMessageId?: string;
  detail?: string;
}

export async function sendWhatsApp(creds: { phoneNumberId: string | null; accessTokenEnc: string | null }, to: string, body: string): Promise<TransportResult> {
  if (!creds.phoneNumberId || !creds.accessTokenEnc) return { status: "dormant", detail: "WhatsApp not connected" };
  try {
    const token = decryptField(creds.accessTokenEnc);
    const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } }),
    });
    if (!res.ok) return { status: "failed", detail: `Meta HTTP ${res.status}` };
    const json = (await res.json()) as { messages?: { id: string }[] };
    return { status: "sent", providerMessageId: json.messages?.[0]?.id };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : "send error" };
  }
}

/** BulkSMS creds: admin-configured (encrypted) first, then env. */
export async function getBulkSmsCreds(): Promise<{ tokenId: string; tokenSecret: string } | null> {
  const cfg = await getPlatformIntegration("bulksms");
  if (cfg?.enabled && cfg.creds.tokenId && cfg.creds.tokenSecret) return { tokenId: cfg.creds.tokenId, tokenSecret: cfg.creds.tokenSecret };
  const tokenId = process.env.PHILA_BULKSMS_TOKEN_ID;
  const tokenSecret = process.env.PHILA_BULKSMS_TOKEN_SECRET;
  return tokenId && tokenSecret ? { tokenId, tokenSecret } : null;
}

/** Resend creds: admin-configured (encrypted) first, then env. */
export async function getResendCreds(): Promise<{ apiKey: string; from: string } | null> {
  const cfg = await getPlatformIntegration("resend");
  if (cfg?.enabled && cfg.creds.apiKey && cfg.creds.from) return { apiKey: cfg.creds.apiKey, from: cfg.creds.from };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PHILA_EMAIL_FROM;
  return apiKey && from ? { apiKey, from } : null;
}

export async function sendSms(to: string, body: string): Promise<TransportResult> {
  const creds = await getBulkSmsCreds();
  if (!creds) return { status: "dormant", detail: "Phila SMS not configured" };
  try {
    const auth = Buffer.from(`${creds.tokenId}:${creds.tokenSecret}`).toString("base64");
    const res = await fetch("https://api.bulksms.com/v1/messages", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, body, encoding: "UNICODE" }),
    });
    if (!res.ok) return { status: "failed", detail: `BulkSMS HTTP ${res.status}` };
    const json = (await res.json()) as { id?: string }[];
    return { status: "sent", providerMessageId: Array.isArray(json) ? json[0]?.id : undefined };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : "send error" };
  }
}

export async function sendEmail(to: string, subject: string, body: string, fromName: string, replyTo: string | null): Promise<TransportResult> {
  const creds = await getResendCreds();
  if (!creds) return { status: "dormant", detail: "Phila email not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName || "Phila"} <${creds.from}>`, to, subject, text: body, reply_to: replyTo || undefined }),
    });
    if (!res.ok) return { status: "failed", detail: `Resend HTTP ${res.status}` };
    const json = (await res.json()) as { id?: string };
    return { status: "sent", providerMessageId: json.id };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : "send error" };
  }
}
