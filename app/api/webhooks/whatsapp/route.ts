import { NextResponse } from "next/server";
import { addOptOut, getOrgByWhatsappPhone, whatsappVerifyTokenExists, updateMessageStatus } from "@/db/queries/messaging";

export const dynamic = "force-dynamic";

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
  let payload: WhatsAppWebhook;
  try {
    payload = (await req.json()) as WhatsAppWebhook;
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed; Meta retries
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
