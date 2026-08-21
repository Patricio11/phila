import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { voiceCallLegs } from "@/db/schema";
import { getSwitchboard } from "@/lib/voice";
import { atDialXml, mapAtStatus } from "@/lib/voice/africastalking";
import { settleVoiceLeg } from "@/lib/voice/settle";

export const dynamic = "force-dynamic";

/**
 * Phase 33.9b - Africa's Talking's door. AT doesn't sign requests, so
 * authenticity is the unguessable token in the path (generated when the AT
 * card is saved, part of the callback URL pasted into AT's number settings)
 * plus the standing rule that only legs WE placed are ever acted on.
 *
 * One URL, two moments (that's AT's model - the callback is configured per
 * NUMBER):
 *  - the call is ANSWERED (`isActive: "1"`): answer with the Dial XML that
 *    bridges the client (the leg carries the number - `bridge_to`);
 *  - the FINAL notification (`isActive: "0"`, with `durationInSeconds`):
 *    settle the leg through the same money path as every other provider.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = await getSwitchboard();
  if (!sb.at.webhookToken || token !== sb.at.webhookToken) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false }, { status: 400 });
  const p: Record<string, string> = {};
  for (const [k, v] of form.entries()) p[k] = String(v);

  const sessionId = p.sessionId ?? "";
  if (!sessionId) return NextResponse.json({ ok: true, ignored: "no session" });

  const db = getDb();
  const [leg] = await db.select({ id: voiceCallLegs.id, bridgeTo: voiceCallLegs.bridgeTo, provider: voiceCallLegs.provider })
    .from(voiceCallLegs).where(eq(voiceCallLegs.id, sessionId)).limit(1);
  // Only calls we placed: an unknown session gets a polite reject, never a bridge.
  if (!leg || leg.provider !== "africastalking") {
    return p.isActive === "1"
      ? new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`, { headers: { "Content-Type": "application/xml" } })
      : NextResponse.json({ ok: true, ignored: "unknown leg" });
  }

  // The bridge moment: the counsellor answered - dial the client on the shared number.
  if (p.isActive === "1") {
    if (!leg.bridgeTo) {
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`, { headers: { "Content-Type": "application/xml" } });
    }
    await db.update(voiceCallLegs).set({ status: "answered" }).where(eq(voiceCallLegs.id, leg.id));
    return new NextResponse(atDialXml(leg.bridgeTo, sb.at.callerNumber), { headers: { "Content-Type": "application/xml" } });
  }

  // The final notification: settle identically to every other provider.
  const res = await settleVoiceLeg({
    callId: sessionId,
    status: mapAtStatus(p),
    durationSec: Number(p.durationInSeconds ?? 0) || 0,
  });
  return NextResponse.json(res);
}
