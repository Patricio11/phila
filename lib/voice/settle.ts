import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments, voiceCallLegs } from "@/db/schema";
import { billedMinutes } from "@/lib/voice/billing";
import { logAccess } from "@/lib/audit";
import type { VoiceLegStatus } from "@/lib/voice/adapter";

/**
 * Phase 33.5 → 33.9 - settling a voice leg, extracted so EVERY provider's
 * webhook (Twilio, Africa's Talking, mock) runs the identical money path:
 * update the leg, bill the org's minute balance exactly once per leg (the
 * idempotent ledger ref makes a webhook retry harmless), warn on low credit,
 * and stamp the appointment's system-measured "held by phone" total. Billing
 * is ALWAYS the system-measured duration - never the provider's own amount -
 * so a provider switch can never change what an org is charged.
 */
export async function settleVoiceLeg(input: { callId: string; status: VoiceLegStatus; durationSec: number }): Promise<{ ok: boolean; ignored?: string }> {
  const db = getDb();
  const [leg] = await db.select().from(voiceCallLegs).where(eq(voiceCallLegs.id, input.callId)).limit(1);
  if (!leg) return { ok: true, ignored: "unknown leg" };

  const ended = ["completed", "failed", "no_answer", "busy", "canceled"].includes(input.status);
  await db.update(voiceCallLegs).set({
    status: input.status,
    durationSec: input.durationSec || leg.durationSec,
    endedAt: ended ? new Date() : leg.endedAt,
    // The bridge target has done its job once the call ends - keep the leg number-free.
    ...(ended ? { bridgeTo: null } : {}),
  }).where(eq(voiceCallLegs.id, leg.id));

  if (input.status === "completed" && input.durationSec > 0) {
    const mins = billedMinutes(input.durationSec);
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
      actor: { userId: "system:voice", platformRole: null, teamRole: null },
      orgId: leg.orgId,
      target: `voice_leg:${leg.id}`,
      reason: `call_billed_${mins}min`,
    });

    // 33.7 - the SYSTEM-measured "Held by phone" marker (every completed leg summed).
    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`coalesce(sum(${voiceCallLegs.billedMin}), 0)::int` })
      .from(voiceCallLegs)
      .where(and(eq(voiceCallLegs.appointmentId, leg.appointmentId), eq(voiceCallLegs.orgId, leg.orgId), eq(voiceCallLegs.status, "completed")));
    await db.update(appointments)
      .set({ heldByPhone: true, callDurationMin: total })
      .where(and(eq(appointments.id, leg.appointmentId), eq(appointments.orgId, leg.orgId)));
  }
  return { ok: true };
}
