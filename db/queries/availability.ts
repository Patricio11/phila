import "server-only";
import { and, eq, gte, lt, ne, inArray } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { counsellorAvailability, counsellors, appointments } from "@/db/schema";
import { isoWeekday } from "@/lib/domain/helpers";
import type { BusinessHours } from "@/lib/domain/types";

/**
 * Feedback #5 — per-counsellor availability. ORG-managed windows per weekday;
 * a counsellor with no rows inherits the org's business hours. Read by the hub
 * booking modal, the public slot engine, and the counsellor's read-only view.
 */

export interface AvailabilityWindow { weekday: number; start: string; end: string }

/** All of one counsellor's windows (sorted weekday, then start). */
export async function getCounsellorAvailabilityDb(orgId: string, counsellorId: string): Promise<AvailabilityWindow[]> {
  return runForOrg(orgId, async () => {
    const rows = await activeDb().select({ weekday: counsellorAvailability.weekday, start: counsellorAvailability.start, end: counsellorAvailability.end })
      .from(counsellorAvailability)
      .where(and(eq(counsellorAvailability.orgId, orgId), eq(counsellorAvailability.counsellorId, counsellorId)));
    return rows.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  });
}

/** Replace a counsellor's whole pattern in one save (the editor's model). */
export async function saveCounsellorAvailabilityDb(orgId: string, counsellorId: string, windows: AvailabilityWindow[]): Promise<void> {
  await runForOrg(orgId, async () => {
    await activeDb().delete(counsellorAvailability)
      .where(and(eq(counsellorAvailability.orgId, orgId), eq(counsellorAvailability.counsellorId, counsellorId)));
    if (windows.length > 0) {
      await activeDb().insert(counsellorAvailability).values(windows.map((w) => ({ orgId, counsellorId, weekday: w.weekday, start: w.start, end: w.end })));
    }
  });
}

/** The org-wide map counsellorId → windows (public engine + modal filter). Owner read — no session on /o. */
export async function getOrgAvailabilityMapDb(orgId: string): Promise<Map<string, AvailabilityWindow[]>> {
  const rows = await getDb().select({ counsellorId: counsellorAvailability.counsellorId, weekday: counsellorAvailability.weekday, start: counsellorAvailability.start, end: counsellorAvailability.end })
    .from(counsellorAvailability).where(eq(counsellorAvailability.orgId, orgId));
  const map = new Map<string, AvailabilityWindow[]>();
  for (const r of rows) {
    const list = map.get(r.counsellorId) ?? [];
    list.push({ weekday: r.weekday, start: r.start, end: r.end });
    map.set(r.counsellorId, list);
  }
  return map;
}

const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Who can take a session at [startISO, +durationMin)? A counsellor qualifies when
 * the whole session fits one of their windows (or the org's hours when they have
 * none) AND they have no blocking booking then. Several counsellors can share the
 * hour — that's the point.
 */
export async function availableCounsellorsAtDb(
  orgId: string,
  startISO: string,
  durationMin: number,
  businessHours: BusinessHours,
): Promise<{ available: string[]; total: number }> {
  const db = getDb();
  const all = await db.select({ id: counsellors.id }).from(counsellors).where(eq(counsellors.orgId, orgId));
  const map = await getOrgAvailabilityMapDb(orgId);

  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startISO));
  const timeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(startISO));
  const wd = isoWeekday(date);
  const t = hm(timeStr);
  const end = t + durationMin;

  const bh = businessHours[wd as keyof BusinessHours];
  const inOrgHours = Boolean(bh) && t >= hm(bh!.start) && end <= hm(bh!.end);

  // Blocking bookings overlapping the slot, org-wide in one query.
  const startAt = new Date(startISO);
  const endAt = new Date(startAt.getTime() + durationMin * 60_000);
  const busyRows = await db.select({ counsellorId: appointments.counsellorId, startsAt: appointments.startsAt, durationMin: appointments.durationMin })
    .from(appointments)
    .where(and(
      eq(appointments.orgId, orgId),
      ne(appointments.state, "cancelled"),
      gte(appointments.startsAt, new Date(startAt.getTime() - 12 * 3_600_000)),
      lt(appointments.startsAt, endAt),
    ));
  const busy = new Set(
    busyRows
      .filter((b) => b.startsAt.getTime() < endAt.getTime() && b.startsAt.getTime() + b.durationMin * 60_000 > startAt.getTime())
      .map((b) => b.counsellorId),
  );

  const available = all
    .filter((c) => {
      const windows = map.get(c.id);
      const fits = windows === undefined
        ? inOrgHours
        : windows.some((w) => w.weekday === wd && t >= hm(w.start) && end <= hm(w.end));
      return fits && !busy.has(c.id);
    })
    .map((c) => c.id);

  return { available, total: all.length };
}

/** Least-loaded pick for auto-assignment: fewest blocking sessions that day. */
export async function leastLoadedOfDb(orgId: string, counsellorIds: string[], date: string): Promise<string | null> {
  if (counsellorIds.length === 0) return null;
  if (counsellorIds.length === 1) return counsellorIds[0]!;
  const from = new Date(`${date}T00:00:00+02:00`);
  const to = new Date(from.getTime() + 24 * 3_600_000);
  const rows = await getDb().select({ counsellorId: appointments.counsellorId })
    .from(appointments)
    .where(and(eq(appointments.orgId, orgId), inArray(appointments.counsellorId, counsellorIds), ne(appointments.state, "cancelled"), gte(appointments.startsAt, from), lt(appointments.startsAt, to)));
  const load = new Map<string, number>(counsellorIds.map((id) => [id, 0]));
  for (const r of rows) load.set(r.counsellorId, (load.get(r.counsellorId) ?? 0) + 1);
  return [...counsellorIds].sort((a, b) => (load.get(a)! - load.get(b)!) || a.localeCompare(b))[0]!;
}
