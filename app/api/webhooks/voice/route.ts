import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments, voiceCallLegs } from "@/db/schema";
import { getVoiceConfig, adapterFor } from "@/lib/voice";
import { billedMinutes } from "@/lib/voice/billing";
import { logAccess } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Phase 33.3/33.5 - the voice status webhook. The provider reports each leg's
 * lifecycle + the carrier's authoritative duration; on COMPLETED we bill the
 * org's minute balance (rounded up per minute) exactly once per leg - a
 * webhook retry can never double-charge. Signature-verified; unknown legs are
 * acknowledged and ignored (we only trust calls we placed).
 */
export async function POST(req: Request) {
  const cfg = await getVoiceConfig();
  if (!cfg) return NextResponse.json({ ok: true, ignored: "voice off" });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false }, { status: 400 });
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const adapter = adapterFor(cfg);
  const parsed = adapter.parseWebhook({
    url: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/webhooks/voice`,
    params,
    signature: req.headers.get("x-twilio-signature"),
  });
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 403 });

  const db = getDb();
  const [leg] = await db.select().from(voiceCallLegs).where(eq(voiceCallLegs.id, parsed.callId)).limit(1);
  if (!leg) return NextResponse.json({ ok: true, ignored: "unknown leg" });

  const ended = ["completed", "failed", "no_answer", "busy", "canceled"].includes(parsed.status);
  await db.update(voiceCallLegs).set({
    status: parsed.status,
    durationSec: parsed.durationSec || leg.durationSec,
    endedAt: ended ? new Date() : leg.endedAt,
  }).where(eq(voiceCallLegs.id, leg.id));

  // Billing moment: the leg completed with real connected time.
  if (parsed.status === "completed" && parsed.durationSec > 0) {
    const mins = billedMinutes(parsed.durationSec);
    const { applyCredit, getCreditBalances } = await import("@/db/queries/messaging");
    const before = (await getCreditBalances(leg.orgId)).voice;
    const after = await applyCredit(leg.orgId, "voice", -mins, "call", `voice_leg:${leg.id}`, `voice_leg_${leg.id}`);
    await db.update(voiceCallLegs).set({ billedMin: mins }).where(eq(voiceCallLegs.id, leg.id));
    try {
      const { notifyIfLowCredit } = await import("@/lib/messaging/low-credit");
      await notifyIfLowCredit(leg.orgId, "voice", before, after);
    } catch { /* the ledger is the truth */ }
    await logAccess({
      action: "admin.action",
      actor: { userId: `system:voice`, platformRole: null, teamRole: null },
      orgId: leg.orgId,
      target: `voice_leg:${leg.id}`,
      reason: `call_billed_${mins}min`,
    });

    // 33.7 - a VoicePhila call auto-records the "Held by phone" marker with
    // the SYSTEM-measured total (every completed leg summed). The manual entry
    // stays for calls made outside the platform; this one is authoritative.
    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`coalesce(sum(${voiceCallLegs.billedMin}), 0)::int` })
      .from(voiceCallLegs)
      .where(and(eq(voiceCallLegs.appointmentId, leg.appointmentId), eq(voiceCallLegs.orgId, leg.orgId), eq(voiceCallLegs.status, "completed")));
    await db.update(appointments)
      .set({ heldByPhone: true, callDurationMin: total })
      .where(and(eq(appointments.id, leg.appointmentId), eq(appointments.orgId, leg.orgId)));
  }

  return NextResponse.json({ ok: true });
}
