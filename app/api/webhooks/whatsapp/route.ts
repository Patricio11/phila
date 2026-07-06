import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { addOptOut, getOrgByWhatsappPhone, getWhatsappAppSecretByPhone, whatsappVerifyTokenExists, updateMessageStatus } from "@/db/queries/messaging";

export const dynamic = "force-dynamic";

/** Verify Meta's `X-Hub-Signature-256` HMAC over the raw body with the org's app secret. */
function signatureValid(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const got = header.slice("sha256=".length);
  const want = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  if (got.length !== want.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(want, "hex"));
  } catch {
    return false;
  }
}

/**
 * WhatsApp Cloud API webhook (Phase 12.6). One URL for every org; routed by the
 * inbound `phone_number_id`. GET answers Meta's verification challenge; POST
 * handles inbound messages (STOP → opt-out, POPIA) and delivery status updates
 * (sent → delivered/read/failed on message_log). Dormant until an org connects.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode === "subscribe" && (await whatsappVerifyTokenExists(token))) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

const OPT_OUT_WORDS = new Set(["stop", "stopp", "unsubscribe", "cancel", "opt out", "optout"]);

export async function POST(req: Request) {
  // Read the RAW body first — the HMAC is over the exact bytes Meta sent.
  const rawBody = await req.text();
  let payload: WhatsAppWebhook;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhook;
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed; Meta retries
  }

  // Verify the signature with the receiving org's app secret (routed by phone_number_id).
  // Single-URL multi-tenant webhook: the routing id is read from the body, then the
  // signature is checked against that org's secret before we act on anything.
  const routePhoneId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  const appSecret = routePhoneId ? await getWhatsappAppSecretByPhone(routePhoneId) : null;
  if (!appSecret || !signatureValid(appSecret, rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = value.metadata?.phone_number_id;
      const orgId = phoneNumberId ? await getOrgByWhatsappPhone(phoneNumberId) : null;

      // Inbound messages  honour STOP as an opt-out.
      for (const msg of value.messages ?? []) {
        const text = (msg.text?.body ?? "").trim().toLowerCase();
        if (orgId && msg.from && OPT_OUT_WORDS.has(text)) {
          await addOptOut(orgId, "whatsapp", `+${msg.from}`, "client replied STOP");
        }
      }
      // Delivery statuses  keep message_log honest.
      for (const st of value.statuses ?? []) {
        if (st.id && st.status) await updateMessageStatus(st.id, st.status === "read" ? "delivered" : st.status);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

interface WhatsAppWebhook {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: { from?: string; text?: { body?: string } }[];
        statuses?: { id?: string; status?: string }[];
      };
    }[];
  }[];
}
