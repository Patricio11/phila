import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { voiceCallLegs } from "@/db/schema";

/**
 * Phase 33.4 - the voice call legs, org-scoped. The legs table has no RLS
 * policy (the webhook writes to it as the system), so every read here filters
 * by org id explicitly - same discipline as the webhook.
 */

export interface VoiceLegView {
  id: string;
  status: string;
  durationSec: number;
  billedMin: number;
  startedAt: string;
  endedAt: string | null;
}

export async function legsForAppointmentDb(orgId: string, appointmentId: string): Promise<VoiceLegView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(voiceCallLegs)
    .where(and(eq(voiceCallLegs.orgId, orgId), eq(voiceCallLegs.appointmentId, appointmentId)))
    .orderBy(desc(voiceCallLegs.startedAt));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    durationSec: r.durationSec,
    billedMin: r.billedMin,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
  }));
}

/** Total VoicePhila minutes ever billed for the org (the Billing "used" line). */
export async function voiceMinutesUsedDb(orgId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${voiceCallLegs.billedMin}), 0)::int` })
    .from(voiceCallLegs)
    .where(eq(voiceCallLegs.orgId, orgId));
  return row?.total ?? 0;
}

/** A call is "in flight" when a leg hasn't reached a terminal status yet. */
export function legActive(status: string): boolean {
  return status === "initiated" || status === "ringing" || status === "answered";
}
