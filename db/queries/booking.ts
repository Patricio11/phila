import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments, clients, consents } from "@/db/schema";
import { rooms as roomsTable, roomAssignments as roomAssignmentsTable } from "@/db/schema";
import { CONSENT_PURPOSES, type ConsentPurpose } from "@/lib/domain/enums";
import { isoWeekday } from "@/lib/domain/helpers";
import { now as clockNow } from "@/lib/clock";

/** Server-side id (randomness is fine  not a React render). */
function rid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export interface PersistBookingInput {
  orgId: string;
  province: string;
  serviceId: string;
  counsellorId: string;
  startsAt: string;
  durationMin: number;
  modality: "in_person" | "online";
  intake: Record<string, string>;
  consents: Partial<Record<ConsentPurpose, boolean>>;
}

/**
 * Persist a public booking (Phase 10): auto-register the client, allocate a free
 * room for in-person (no double-booking), create the scheduled appointment, and
 * record the versioned consent grants  all real rows. The client *account*
 * (password) is created later via the activation link; this is the client record.
 */
export async function persistBooking(input: PersistBookingInput): Promise<{ clientId: string; appointmentId: string; roomName: string | null }> {
  const db = getDb();
  const now = new Date(clockNow());

  const clientId = rid("cl");
  await db.insert(clients).values({
    id: clientId,
    orgId: input.orgId,
    name: input.intake.full_name?.trim() || "New client",
    phone: input.intake.phone?.trim() || null,
    email: input.intake.email?.trim() || null,
    province: input.province,
    primaryCounsellorId: input.counsellorId,
    riskFlag: false,
    createdAt: now,
  });

  // Room allocation for in-person  first active room free at the slot.
  let roomId: string | null = null;
  let roomName: string | null = null;
  if (input.modality === "in_person") {
    const startMs = new Date(input.startsAt).getTime();
    const endMs = startMs + input.durationMin * 60_000;
    const [roomRows, orgAppts, assigns] = await Promise.all([
      db.select().from(roomsTable).where(eq(roomsTable.orgId, input.orgId)),
      db.select().from(appointments).where(eq(appointments.orgId, input.orgId)),
      db.select().from(roomAssignmentsTable).where(eq(roomAssignmentsTable.counsellorId, input.counsellorId)),
    ]);
    const overlaps = (a: { startsAt: Date; durationMin: number }) => {
      const s = a.startsAt.getTime();
      return startMs < s + a.durationMin * 60_000 && endMs > s;
    };
    const busy = new Set(orgAppts.filter((a) => a.roomId && a.state !== "cancelled" && overlaps(a)).map((a) => a.roomId));
    const isFree = (r: { id: string; status: string }) => r.status === "active" && !busy.has(r.id);
    // Prefer the counsellor's assigned room for this weekday/time; else first free.
    const weekday = isoWeekday(input.startsAt.slice(0, 10));
    const hhmm = input.startsAt.slice(11, 16); // SAST wall-clock from the +02:00 instant
    const assigned = assigns.find((ra) => ra.days.includes(weekday) && ra.start <= hhmm && hhmm < ra.end);
    const preferred = assigned ? roomRows.find((r) => r.id === assigned.roomId && isFree(r)) : undefined;
    const free = preferred ?? roomRows.find(isFree);
    roomId = free?.id ?? null;
    roomName = free?.name ?? null;
  }

  const appointmentId = rid("appt");
  try {
    await db.insert(appointments).values({
      id: appointmentId,
      orgId: input.orgId,
      clientId,
      counsellorId: input.counsellorId,
      serviceId: input.serviceId,
      type: input.modality,
      roomId,
      startsAt: new Date(input.startsAt),
      durationMin: input.durationMin,
      state: "scheduled",
      tags: [],
    });
  } catch (e) {
    // The slot was taken between availability-check and insert (the exclusion
    // constraint won the race). Don't leave an orphan client behind.
    await db.delete(clients).where(eq(clients.id, clientId));
    throw e;
  }

  for (const purpose of CONSENT_PURPOSES) {
    if (input.consents[purpose]) {
      await db.insert(consents).values({ orgId: input.orgId, clientId, purpose, state: "granted", version: 1, updatedAt: now }).onConflictDoNothing();
    }
  }

  return { clientId, appointmentId, roomName };
}
