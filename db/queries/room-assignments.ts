import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne, gte, lt } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { roomAssignments, rooms, sites, counsellors, appointments, clients } from "@/db/schema";
import { getOrgAvailabilityMapDb } from "@/db/queries/availability";

/**
 * Feedback #8 — rooms fully functional. Assignments are REAL rows now (the old
 * action was a Part-A mock): many counsellors per room, each on their own
 * day/time pattern, so rotation ("Room 1 Monday, Room 2 Tuesday") is just rows.
 * Saving is availability-aware: warnings are computed here and surfaced before
 * the org commits. History is derived from the permanent appointments record.
 */

export interface AssignmentInput { roomId: string; counsellorId: string; days: number[]; start: string; end: string }

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const overlaps = (aS: string, aE: string, bS: string, bE: string) => hm(aS) < hm(bE) && hm(aE) > hm(bS);

/**
 * Honest pre-save checks. All are WARNINGS (the org may know better — a
 * capacity-2 room, a planned change) — the dialog shows them and asks again.
 */
export async function assignmentWarningsDb(orgId: string, input: AssignmentInput): Promise<string[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [existing, roomRows, counsellorRows, availability] = await Promise.all([
      db.select().from(roomAssignments).where(eq(roomAssignments.orgId, orgId)),
      db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(eq(rooms.orgId, orgId)),
      db.select({ id: counsellors.id, name: counsellors.name }).from(counsellors).where(eq(counsellors.orgId, orgId)),
      getOrgAvailabilityMapDb(orgId),
    ]);
    const nameOf = (id: string) => counsellorRows.find((c) => c.id === id)?.name.split(" ")[0] ?? "They";
    const roomOf = (id: string) => roomRows.find((r) => r.id === id)?.name ?? "another room";
    const warnings: string[] = [];

    // 1) The counsellor's own working windows (feedback #5). No pattern = org hours, no warning.
    const windows = availability.get(input.counsellorId);
    if (windows !== undefined) {
      for (const day of input.days) {
        const dayWindows = windows.filter((w) => w.weekday === day);
        if (dayWindows.length === 0) {
          warnings.push(`${nameOf(input.counsellorId)} doesn't work on ${DOW[day]}s.`);
        } else if (!dayWindows.some((w) => hm(input.start) >= hm(w.start) && hm(input.end) <= hm(w.end))) {
          const span = dayWindows.map((w) => `${w.start}–${w.end}`).join(", ");
          warnings.push(`Outside ${nameOf(input.counsellorId)}'s ${DOW[day]} hours (${span}).`);
        }
      }
    }

    // 2) The counsellor can't be in two rooms at once.
    for (const ra of existing.filter((r) => r.counsellorId === input.counsellorId && r.roomId !== input.roomId)) {
      const sharedDays = ra.days.filter((d) => input.days.includes(d));
      if (sharedDays.length > 0 && overlaps(input.start, input.end, ra.start, ra.end)) {
        warnings.push(`${nameOf(input.counsellorId)} is already in ${roomOf(ra.roomId)} on ${sharedDays.map((d) => DOW[d]).join(" & ")} ${ra.start}–${ra.end}.`);
      }
    }

    // 3) The room's hours can't be double-claimed.
    for (const ra of existing.filter((r) => r.roomId === input.roomId && r.counsellorId !== input.counsellorId)) {
      const sharedDays = ra.days.filter((d) => input.days.includes(d));
      if (sharedDays.length > 0 && overlaps(input.start, input.end, ra.start, ra.end)) {
        warnings.push(`Overlaps ${nameOf(ra.counsellorId)}'s slot in this room (${sharedDays.map((d) => DOW[d]).join(" & ")} ${ra.start}–${ra.end}).`);
      }
    }

    return warnings;
  });
}

/** Persist a new assignment row (many per room and per counsellor are the point). */
export async function saveRoomAssignmentDb(orgId: string, input: AssignmentInput): Promise<{ id: string }> {
  return runForOrg(orgId, async () => {
    const id = `ra_${randomUUID().slice(0, 12)}`;
    await activeDb().insert(roomAssignments).values({
      id, orgId, counsellorId: input.counsellorId, roomId: input.roomId,
      days: [...input.days].sort((a, b) => a - b), start: input.start, end: input.end,
    });
    return { id };
  });
}

/** Remove one assignment. The room's HISTORY is untouched — it lives in appointments. */
export async function removeRoomAssignmentDb(orgId: string, assignmentId: string): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().delete(roomAssignments)
      .where(and(eq(roomAssignments.id, assignmentId), eq(roomAssignments.orgId, orgId)))
      .returning({ id: roomAssignments.id });
    return res.length > 0;
  });
}

export interface RoomHistoryDay {
  date: string;
  counsellors: { name: string; sessions: number; minutes: number }[];
  sessions: { startsAt: string; durationMin: number; counsellorName: string; clientName: string; state: string; type: string }[];
  totalMinutes: number;
}

/**
 * Who was in this room on a given SAST date — the truthful, permanent record,
 * derived from booked sessions (incl. hybrid). Cancelled sessions are excluded.
 */
export async function getRoomHistoryDb(orgId: string, roomId: string, date: string): Promise<RoomHistoryDay> {
  return runForOrg(orgId, async () => {
    const from = new Date(`${date}T00:00:00+02:00`);
    const to = new Date(from.getTime() + 24 * 3_600_000);
    const rows = await activeDb()
      .select({ a: appointments, counsellorName: counsellors.name, clientName: clients.name })
      .from(appointments)
      .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(and(
        eq(appointments.orgId, orgId), eq(appointments.roomId, roomId),
        ne(appointments.state, "cancelled"),
        gte(appointments.startsAt, from), lt(appointments.startsAt, to),
      ));

    const sessions = rows
      .map((r) => ({
        startsAt: r.a.startsAt.toISOString(), durationMin: r.a.durationMin,
        counsellorName: r.counsellorName ?? "Counsellor", clientName: r.clientName ?? "Client",
        state: r.a.state, type: r.a.type,
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const byCounsellor = new Map<string, { sessions: number; minutes: number }>();
    for (const s of sessions) {
      const agg = byCounsellor.get(s.counsellorName) ?? { sessions: 0, minutes: 0 };
      agg.sessions += 1;
      agg.minutes += s.durationMin;
      byCounsellor.set(s.counsellorName, agg);
    }

    return {
      date,
      counsellors: [...byCounsellor.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minutes - a.minutes),
      sessions,
      totalMinutes: sessions.reduce((s, x) => s + x.durationMin, 0),
    };
  });
}

export interface RoomNow {
  id: string;
  name: string;
  colour: string;
  status: string;
  siteName: string;
  /** Who's in it right now (a session is running), or null when free. */
  busy: { counsellorName: string; clientName: string; until: string } | null;
  /** The next session from now (today or later this week). */
  next: { startsAt: string; counsellorName: string; clientName: string } | null;
}

/** The live picture — which rooms are occupied at this moment, and what's next. */
export async function roomsRightNowDb(orgId: string, nowISO: string): Promise<RoomNow[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const now = new Date(nowISO);
    const horizon = new Date(now.getTime() + 7 * 24 * 3_600_000);
    const [roomRows, siteRows, counsellorRows, clientRows, appts] = await Promise.all([
      db.select().from(rooms).where(eq(rooms.orgId, orgId)),
      db.select().from(sites).where(eq(sites.orgId, orgId)),
      db.select({ id: counsellors.id, name: counsellors.name }).from(counsellors).where(eq(counsellors.orgId, orgId)),
      db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.orgId, orgId)),
      db.select().from(appointments).where(and(
        eq(appointments.orgId, orgId), ne(appointments.state, "cancelled"),
        gte(appointments.startsAt, new Date(now.getTime() - 12 * 3_600_000)), lt(appointments.startsAt, horizon),
      )),
    ]);
    const cName = (id: string) => counsellorRows.find((c) => c.id === id)?.name ?? "Counsellor";
    const clName = (id: string) => clientRows.find((c) => c.id === id)?.name ?? "Client";

    return roomRows.map((r) => {
      const inRoom = appts.filter((a) => a.roomId === r.id);
      const current = inRoom.find((a) => a.startsAt.getTime() <= now.getTime() && a.startsAt.getTime() + a.durationMin * 60_000 > now.getTime());
      const next = inRoom.filter((a) => a.startsAt.getTime() > now.getTime()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
      return {
        id: r.id, name: r.name, colour: r.colour, status: r.status,
        siteName: siteRows.find((s) => s.id === r.siteId)?.name ?? "",
        busy: current
          ? { counsellorName: cName(current.counsellorId), clientName: clName(current.clientId), until: new Date(current.startsAt.getTime() + current.durationMin * 60_000).toISOString() }
          : null,
        next: next
          ? { startsAt: next.startsAt.toISOString(), counsellorName: cName(next.counsellorId), clientName: clName(next.clientId) }
          : null,
      };
    });
  });
}
