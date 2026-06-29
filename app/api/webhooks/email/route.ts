import { NextResponse } from "next/server";
import { addOptOut, updateMessageStatus, getMessageOrg } from "@/db/queries/messaging";

export const dynamic = "force-dynamic";

/**
 * Email (Resend) delivery webhook (Phase 12.6). Keeps message_log honest
 * (delivered/failed) and treats a bounce or spam-complaint as an opt-out (POPIA —
 * stop emailing an address that bounced or complained). Dormant until Phila's
 * Resend webhook is configured.
 */
export async function POST(req: Request) {
  let event: ResendEvent;
  try {
    event = (await req.json()) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const id = event.data?.email_id;
  const to = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to;
  if (!id) return NextResponse.json({ ok: true });

  switch (event.type) {
    case "email.delivered":
      await updateMessageStatus(id, "delivered");
      break;
    case "email.bounced":
    case "email.complained": {
      await updateMessageStatus(id, "failed", event.type);
      if (to) {
        const orgId = await getMessageOrg(id);
        if (orgId) await addOptOut(orgId, "email", to, event.type);
      }
      break;
    }
    default:
      break; // delivery_delayed / sent / opened — no state change
  }
  return NextResponse.json({ ok: true });
}

interface ResendEvent {
  type?: string;
  data?: { email_id?: string; to?: string | string[] };
}
