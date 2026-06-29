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
  type: "online" | "in_person";
  roomId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM SAST
  durationMin: number;
  recurring: boolean;
  recurringCount?: number | null; // null = ongoing → 12 weeks materialised
}

/** Create the appointment, plus a weekly series when recurring (linked by seriesId). */
export async function createAppointment(input: CreateAppointmentInput): Promise<void> {
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
}

export type EditScope = "this" | "following";

/**
 * Reschedule. `scope: "this"` moves only this session; `"following"` shifts this
 * session AND every later one in its series by the same delta (the deferrable
 * exclusion constraints let the whole shift land atomically). Returns the count moved.
 */
export async function rescheduleAppointment(appointmentId: string, newStart: string, scope: EditScope = "this"): Promise<number> {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return 0;

  if (scope === "this" || !appt.seriesId) {
    await db.update(appointments).set({ startsAt: new Date(newStart) }).where(eq(appointments.id, appointmentId));
    return 1;
  }

  // Shift this + all later series members by the same delta in ONE statement, so
  // the deferred exclusion constraints only see the final, non-overlapping
  // positions (separate per-row updates would falsely clash mid-shift).
  const deltaSec = Math.round((new Date(newStart).getTime() - appt.startsAt.getTime()) / 1000);
  const res = await db
    .update(appointments)
    .set({ startsAt: sql`${appointments.startsAt} + make_interval(secs => ${deltaSec})` })
    .where(and(eq(appointments.seriesId, appt.seriesId), gte(appointments.startsAt, appt.startsAt), ne(appointments.state, "cancelled")))
    .returning({ id: appointments.id });
  return res.length;
}

/** Cancel, with a reason. `scope: "following"` cancels this + all later series members. */
export async function cancelAppointment(appointmentId: string, reason: string, scope: EditScope = "this"): Promise<number> {
  const db = getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return 0;
  const set = { state: "cancelled", cancelReason: reason || null };

  if (scope === "this" || !appt.seriesId) {
    await db.update(appointments).set(set).where(eq(appointments.id, appointmentId));
    return 1;
  }
  const res = await db
    .update(appointments)
    .set(set)
    .where(and(eq(appointments.seriesId, appt.seriesId), gte(appointments.startsAt, appt.startsAt), ne(appointments.state, "cancelled")))
    .returning({ id: appointments.id });
  return res.length;
}

export async function setAppointmentState(appointmentId: string, state: string): Promise<void> {
  await getDb().update(appointments).set({ state }).where(eq(appointments.id, appointmentId));
}
