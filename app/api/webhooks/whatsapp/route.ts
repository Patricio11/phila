import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { addOptOut, getOrgByWhatsappPhone, getWhatsappAppSecretByPhone, getWhatsappAppSecretByOrg, whatsappVerifyTokenExists, updateMessageStatus, recordWhatsappInbound } from "@/db/queries/messaging";
import { claimEvent, findOrgByDisplayPhone, upsertNumberHealth } from "@/db/queries/whatsapp-health";
import { parseHealthEvent } from "@/lib/messaging/whatsapp-health";

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
  // Read the RAW body first - the HMAC is over the exact bytes Meta sent.
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
  // Phase 34.3 - Meta's number-health events (quality / limit / ban) carry the
  // human number rather than the phone_number_id; route those by display phone.
  const first = payload.entry?.[0]?.changes?.[0];
  const routePhoneId = first?.value?.metadata?.phone_number_id;
  const routeDisplay = first?.value?.display_phone_number;
  let routeOrgId: string | null = routePhoneId ? await getOrgByWhatsappPhone(routePhoneId) : null;
  if (!routeOrgId && routeDisplay) routeOrgId = await findOrgByDisplayPhone(routeDisplay);
  const appSecret = routePhoneId ? await getWhatsappAppSecretByPhone(routePhoneId) : routeOrgId ? await getWhatsappAppSecretByOrg(routeOrgId) : null;
  if (!appSecret || !signatureValid(appSecret, rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const phoneNumberId = value.metadata?.phone_number_id;
        let orgId = phoneNumberId ? await getOrgByWhatsappPhone(phoneNumberId) : null;
        if (!orgId && value.display_phone_number) orgId = await findOrgByDisplayPhone(value.display_phone_number);

        // Number health first - a ban / restriction / quality change.
        const health = parseHealthEvent(change.field, value as Record<string, unknown>);
        if (health && orgId) {
          const evId = `health:${orgId}:${change.field}:${String(value.event ?? "")}:${String(value.current_quality_score ?? value.quality_rating ?? "")}:${String(value.current_limit ?? value.messaging_limit_tier ?? "")}:${entry.time ?? ""}`;
          if (await claimEvent("whatsapp", evId)) await upsertNumberHealth(orgId, health, "meta");
          continue;
        }

        // Inbound messages: every one (re)opens the free 24h service window; STOP also opts out.
        for (const msg of value.messages ?? []) {
          if (!orgId || !msg.from) continue;
          if (msg.id && !(await claimEvent("whatsapp", msg.id))) continue; // Meta redelivered - already handled
          await recordWhatsappInbound(orgId, `+${msg.from}`, new Date());
          const text = (msg.text?.body ?? "").trim().toLowerCase();
          if (OPT_OUT_WORDS.has(text)) {
            await addOptOut(orgId, "whatsapp", `+${msg.from}`, "client replied STOP");
          }
        }
        // Delivery statuses - keep message_log honest: sent -> delivered -> read,
        // never backwards; a failure carries Meta's reason.
        for (const st of value.statuses ?? []) {
          if (!st.id || !st.status) continue;
          if (!(await claimEvent("whatsapp", `${st.id}:${st.status}`))) continue;
          const err = st.errors?.[0];
          const detail = err ? `Meta ${err.code ?? ""} ${err.title ?? err.message ?? ""}`.trim() : undefined;
          await updateMessageStatus(st.id, st.status, detail);
        }
      }
    }
  } catch (e) {
    // A real handler failure must NOT be swallowed with a 200 - Meta retries on
    // non-2xx, and idempotency makes that retry safe.
    return NextResponse.json({ error: e instanceof Error ? e.message : "handler error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

interface WhatsAppWebhook {
  entry?: {
    time?: number;
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        display_phone_number?: string;
        event?: string;
        current_quality_score?: string;
        quality_rating?: string;
        current_limit?: string;
        messaging_limit_tier?: string;
        messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[];
        statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string; message?: string }[] }[];
      };
    }[];
  }[];
}
