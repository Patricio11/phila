import { NextResponse } from "next/server";
import { and, eq, inArray, max } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clients, appointments, demographics, outcomeMeasures, carePlans, sessionNotes, clientDocuments } from "@/db/schema";
import { retentionClock, retentionExpired } from "@/lib/compliance/retention";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";

/**
 * Phase 31.2 - the retention pruner. Scans every client's computed HPCSA clock
 * and, ONLY for lapsed records not under legal hold, de-identifies + destroys
 * the clinical children (notes, outcomes, demographics, care plan, document
 * rows). Appointment rows are kept pseudonymised so historical counts stay
 * honest (Outcome-Honesty Rule).
 *
 * SAFETY (plan §31.2 honest constraints - destruction is irreversible):
 *   - Ships REPORT-ONLY. Destruction requires the explicit platform env
 *     `RETENTION_PRUNER_MODE=destroy` - never on by default, never org-set.
 *   - Auth fails closed in production (CRON_SECRET bearer, same as reminders).
 *   - A record inside its clock or under legal hold is NEVER touched.
 *   - Every destruction is FAIL-STRICT audited (`dsar.erase`, reason
 *     `retention_pruner`) - if the audit line can't be written, nothing is destroyed.
 */
async function sweep(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "cron not configured" }, { status: 503 });
    }
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const destroy = process.env.RETENTION_PRUNER_MODE === "destroy";
  const nowISO = clockNow();
  const db = getDb();

  const all = await db.select({ id: clients.id, orgId: clients.orgId, name: clients.name, profile: clients.profile, legalHold: clients.legalHold, createdAt: clients.createdAt }).from(clients);
  const lasts = await db.select({ clientId: appointments.clientId, last: max(appointments.startsAt) }).from(appointments).groupBy(appointments.clientId);
  const lastBy = new Map(lasts.map((l) => [l.clientId, l.last]));

  const candidates: { clientId: string; orgId: string; retainUntil: string | null; legalHold: boolean }[] = [];
  let held = 0;
  for (const c of all) {
    const lastEntryAt = (lastBy.get(c.id) ?? c.createdAt).toISOString();
    const dob = (c.profile as Record<string, string> | null)?.dateOfBirth || null;
    const clock = retentionClock({ lastEntryAt, dateOfBirth: dob });
    if (!retentionExpired(clock, nowISO)) continue;
    if (c.legalHold) { held++; continue; } // expired but held - reported, never touched
    candidates.push({ clientId: c.id, orgId: c.orgId, retainUntil: clock.retainUntil, legalHold: false });
  }

  let destroyed = 0;
  if (destroy) {
    for (const cand of candidates) {
      // Fail-strict: an unlogged destruction must not happen - logAccess throws → skip.
      await logAccess({
        action: "dsar.erase",
        actor: { userId: "system:retention-pruner", platformRole: "super_admin", teamRole: null },
        orgId: cand.orgId,
        target: `client:${cand.clientId}`,
        reason: "retention_pruner",
        meta: { retainUntil: cand.retainUntil ?? "" },
      });
      const apptIds = (await db.select({ id: appointments.id }).from(appointments)
        .where(and(eq(appointments.orgId, cand.orgId), eq(appointments.clientId, cand.clientId)))).map((a) => a.id);
      if (apptIds.length) await db.delete(sessionNotes).where(inArray(sessionNotes.appointmentId, apptIds));
      await db.delete(outcomeMeasures).where(eq(outcomeMeasures.clientId, cand.clientId));
      await db.delete(demographics).where(eq(demographics.clientId, cand.clientId));
      await db.delete(carePlans).where(eq(carePlans.clientId, cand.clientId));
      await db.delete(clientDocuments).where(eq(clientDocuments.clientId, cand.clientId));
      await db.update(clients).set({
        name: `Removed client ${cand.clientId.slice(-4).toUpperCase()}`,
        phone: null, email: null, referralSource: null, profile: {}, deletedAt: new Date(nowISO),
      }).where(and(eq(clients.id, cand.clientId), eq(clients.orgId, cand.orgId)));
      destroyed++;
    }
  }

  return NextResponse.json({
    mode: destroy ? "destroy" : "report-only",
    scanned: all.length,
    lapsed: candidates.length,
    heldBack: held,
    destroyed,
    candidates: destroy ? undefined : candidates,
  });
}

export async function GET(req: Request) { return sweep(req); }
export async function POST(req: Request) { return sweep(req); }
