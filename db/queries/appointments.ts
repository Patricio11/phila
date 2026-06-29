import "server-only";
import { eq } from "drizzle-orm";
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

/** Create the appointment, plus a weekly series when recurring. */
export async function createAppointment(input: CreateAppointmentInput): Promise<void> {
  const db = getDb();
  const count = input.recurring ? input.recurringCount ?? 12 : 1;
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
  }));
  await db.insert(appointments).values(rows);
}

export async function rescheduleAppointment(appointmentId: string, newStart: string): Promise<void> {
  await getDb().update(appointments).set({ startsAt: new Date(newStart) }).where(eq(appointments.id, appointmentId));
}

export async function setAppointmentState(appointmentId: string, state: string): Promise<void> {
  await getDb().update(appointments).set({ state }).where(eq(appointments.id, appointmentId));
}
