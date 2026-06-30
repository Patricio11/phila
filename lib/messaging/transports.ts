import "server-only";
import { decryptField } from "@/lib/crypto";

/**
 * Real-shaped transports, dormant-by-default. Each makes the actual provider call
 * when configured, and returns an HONEST result otherwise ("dormant"  never a
 * fake "sent"). WhatsApp uses the ORG's Meta Cloud API number; SMS (BulkSMS) and
 * email (Resend) use Phila's platform credentials from env (set in Phase 12.5).
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

export async function sendSms(to: string, body: string): Promise<TransportResult> {
  const id = process.env.PHILA_BULKSMS_TOKEN_ID;
  const secret = process.env.PHILA_BULKSMS_TOKEN_SECRET;
  if (!id || !secret) return { status: "dormant", detail: "Phila SMS not configured" };
  try {
    const auth = Buffer.from(`${id}:${secret}`).toString("base64");
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
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PHILA_EMAIL_FROM; // e.g. notifications@phila.co.za (verified domain)
  if (!key || !from) return { status: "dormant", detail: "Phila email not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName || "Phila"} <${from}>`, to, subject, text: body, reply_to: replyTo || undefined }),
    });
    if (!res.ok) return { status: "failed", detail: `Resend HTTP ${res.status}` };
    const json = (await res.json()) as { id?: string };
    return { status: "sent", providerMessageId: json.id };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : "send error" };
  }
}
