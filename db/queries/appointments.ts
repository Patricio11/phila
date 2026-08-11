import "server-only";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments } from "@/db/schema";

function rid(): string {
  return `appt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
function addWeeks(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export interface CreateAppointmentInput {
  orgId: string;
  clientId: string;
  serviceId: string;
  counsellorId: string;
  type: "online" | "in_person" | "hybrid";
  roomId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM SAST
  durationMin: number;
  recurring: boolean;
  recurringCount?: number | null; // null = ongoing → 12 weeks materialised
}

/** Create the appointment, plus a weekly series when recurring (linked by seriesId). */
export async function createAppointment(input: CreateAppointmentInput): Promise<{ firstId: string }> {
  const db = getDb();
  const count = input.recurring ? input.recurringCount ?? 12 : 1;
  const seriesId = count > 1 ? rid().replace("appt_", "series_") : null;
  const rows = Array.from({ length: count }, (_, i) => ({
    id: rid(),
    orgId: input.orgId,
    clientId: input.clientId,
    counsellorId: input.counsellorId,
    serviceId: input.serviceId,
    type: input.type,
    roomId: input.roomId,
    startsAt: new Date(`${addWeeks(input.date, i)}T${input.time}:00+02:00`),
    durationMin: input.durationMin,
    state: "scheduled",
    tags: [] as string[],
    seriesId,
  }));
  await db.insert(appointments).values(rows);
  return { firstId: rows[0]!.id };
}

/**
 * Add N more weekly sessions to the end of an existing series - the counsellor's
 * "we need more time" moment. The template is the series' LAST session (same
 * client, service, room, type, duration, wall-clock time); new rows join the same
 * seriesId so edit-this/all and cancel-following keep working. `counsellorId`
 * (when given) restricts the series to that counsellor's own - a counsellor can
 * extend only their series; the Hub passes nothing and can extend any.
 * Conflicts are caught by the exclusion constraints on insert (all-or-nothing).
 */
export async function extendAppointmentSeries(
  orgId: string,
  seriesId: string,
  addCount: number,
  opts?: { counsellorId?: string },
): Promise<{ added: number; firstNewId: string; lastStartsAt: Date } | { error: "not_found" | "not_yours" }> {
  const db = getDb();
  const rows = await db.select().from(appointments)
    .where(and(eq(appointments.orgId, orgId), eq(appointments.seriesId, seriesId), ne(appointments.state, "cancelled")))
    .orderBy(appointments.startsAt);
  const last = rows[rows.length - 1];
  if (!last) return { error: "not_found" };
  if (opts?.counsellorId && last.counsellorId !== opts.counsellorId) return { error: "not_yours" };

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // SAST has no DST - wall-clock time is preserved
  const fresh = Array.from({ length: addCount }, (_, i) => ({
    id: rid(),
    orgId,
    clientId: last.clientId,
    counsellorId: last.counsellorId,
    serviceId: last.serviceId,
    type: last.type,
    roomId: last.roomId,
    startsAt: new Date(last.startsAt.getTime() + WEEK_MS * (i + 1)),
    durationMin: last.durationMin,
    state: "scheduled",
    tags: [] as string[],
    seriesId,
  }));
  await db.insert(appointments).values(fresh);
  return { added: fresh.length, firstNewId: fresh[0]!.id, lastStartsAt: fresh[fresh.length - 1]!.startsAt };
}

/**
 * The counsellor's recurring series that are running out - scheduled sessions
 * remaining after `nowISO`, grouped per series. "Ending soon" is the caller's
 * call; this returns every live series with its remaining count so the dashboard
 * can nudge at <= threshold.
 */
export async function listCounsellorSeriesDb(
  orgId: string,
  counsellorId: string,
  nowISO: string,
): Promise<Array<{ seriesId: string; clientId: string; total: number; remaining: number; lastStartsAt: Date; durationMin: number }>> {
  const db = getDb();
  const now = new Date(nowISO);
  const rows = await db.select({
    seriesId: appointments.seriesId,
    clientId: appointments.clientId,
    startsAt: appointments.startsAt,
    state: appointments.state,
    durationMin: appointments.durationMin,
  }).from(appointments)
    .where(and(eq(appointments.orgId, orgId), eq(appointments.counsellorId, counsellorId), ne(appointments.state, "cancelled")))
    .orderBy(appointments.startsAt);

  const bySeries = new Map<string, { clientId: string; total: number; remaining: number; lastStartsAt: Date; durationMin: number }>();
  for (const r of rows) {
    if (!r.seriesId) continue;
    const cur = bySeries.get(r.seriesId) ?? { clientId: r.clientId, total: 0, remaining: 0, lastStartsAt: r.startsAt, durationMin: r.durationMin };
    cur.total += 1;
    if (r.state === "scheduled" && r.startsAt > now) cur.remaining += 1;
    if (r.startsAt > cur.lastStartsAt) cur.lastStartsAt = r.startsAt;
    bySeries.set(r.seriesId, cur);
  }
  // A series that ended within the last week still counts - "we finished on the
  // 5th and need more" is exactly the moment to extend. Older than that is done.
  const graceCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return [...bySeries.entries()]
    .map(([seriesId, v]) => ({ seriesId, ...v }))
    .filter((s) => s.lastStartsAt > graceCutoff);
}

export type EditScope = "this" | "following";

/**
 * Reschedule. `scope: "this"` moves only this session; `"following"` shifts this
 * session AND every later one in its series by the same delta (the deferrable
 * exclusion constraints let the whole shift land atomically). Returns the count moved.
 *
 * Every read + write is scoped by `orgId` (the tenant boundary), so a caller can
 * only ever move their own org's appointments  a cross-org id resolves to 0.
 */
export async function rescheduleAppointment(orgId: string, appointmentId: string, newStart: string, scope: EditScope = "this", note?: string | null): Promise<number> {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId))).limit(1);
  if (!appt) return 0;
  const rescheduleNote = note?.trim() ? note.trim() : null;

  if (scope === "this" || !appt.seriesId) {
    await db.update(appointments).set({ startsAt: new Date(newStart), ...(rescheduleNote ? { rescheduleNote } : {}) }).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)));
    return 1;
  }

  // Shift this + all later series members by the same delta in ONE statement, so
  // the deferred exclusion constraints only see the final, non-overlapping
  // positions (separate per-row updates would falsely clash mid-shift).
  const deltaSec = Math.round((new Date(newStart).getTime() - appt.startsAt.getTime()) / 1000);
  const res = await db
    .update(appointments)
    .set({ startsAt: sql`${appointments.startsAt} + make_interval(secs => ${deltaSec})` })
    .where(and(eq(appointments.orgId, orgId), eq(appointments.seriesId, appt.seriesId), gte(appointments.startsAt, appt.startsAt), ne(appointments.state, "cancelled")))
    .returning({ id: appointments.id });
  // The reason lives on the anchor session that was moved (kept on the record).
  if (rescheduleNote) await db.update(appointments).set({ rescheduleNote }).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)));
  return res.length;
}

/** Cancel, with a reason. `scope: "following"` cancels this + all later series members. Org-scoped. */
export async function cancelAppointment(orgId: string, appointmentId: string, reason: string, scope: EditScope = "this"): Promise<number> {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId))).limit(1);
  if (!appt) return 0;
  const set = { state: "cancelled", cancelReason: reason || null };

  if (scope === "this" || !appt.seriesId) {
    await db.update(appointments).set(set).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)));
    return 1;
  }
  const res = await db
    .update(appointments)
    .set(set)
    .where(and(eq(appointments.orgId, orgId), eq(appointments.seriesId, appt.seriesId), gte(appointments.startsAt, appt.startsAt), ne(appointments.state, "cancelled")))
    .returning({ id: appointments.id });
  return res.length;
}

/** Flip an appointment's lifecycle state, org-scoped. Returns the number of rows changed (0 = not found / wrong org). */
export async function setAppointmentState(orgId: string, appointmentId: string, state: string): Promise<number> {
  const res = await getDb()
    .update(appointments)
    .set({ state })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)))
    .returning({ id: appointments.id });
  return res.length;
}

/** Batch 2v - what an edit can change without deleting and rebooking. */
export interface AppointmentPatch {
  serviceId?: string;
  counsellorId?: string;
  type?: string;
  roomId?: string | null;
  durationMin?: number;
}

/**
 * Change the substance of a booking - service, counsellor, where, room, length -
 * in place. `scope: "following"` carries the change to this + every later
 * session in the series (skipping cancelled ones). Date and time stay with
 * rescheduleAppointment: moving in time and changing substance are different
 * decisions, and the exclusion constraints check them differently.
 */
export async function updateAppointmentDetailsDb(
  orgId: string,
  appointmentId: string,
  patch: AppointmentPatch,
  scope: EditScope = "this",
): Promise<number> {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId))).limit(1);
  if (!appt) return 0;

  const set: Record<string, unknown> = {};
  if (patch.serviceId !== undefined) set.serviceId = patch.serviceId;
  if (patch.counsellorId !== undefined) set.counsellorId = patch.counsellorId;
  if (patch.type !== undefined) set.type = patch.type;
  if (patch.roomId !== undefined) set.roomId = patch.roomId;
  if (patch.durationMin !== undefined) set.durationMin = patch.durationMin;
  if (Object.keys(set).length === 0) return 0;

  if (scope === "this" || !appt.seriesId) {
    const res = await db.update(appointments).set(set)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)))
      .returning({ id: appointments.id });
    return res.length;
  }
  const res = await db.update(appointments).set(set)
    .where(and(
      eq(appointments.orgId, orgId), eq(appointments.seriesId, appt.seriesId),
      gte(appointments.startsAt, appt.startsAt), ne(appointments.state, "cancelled"),
    ))
    .returning({ id: appointments.id });
  return res.length;
}
