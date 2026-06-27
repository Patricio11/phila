/**
 * Seam helpers  these mirror the Part-B engine logic exactly (DESIGN.md §11) so
 * the mock demo behaves like production and Phase 11/16 is a swap, not a rewrite.
 * South Africa runs on a single timezone with no DST, so wall-clock times are
 * anchored to a fixed +02:00 (SAST) offset.
 */
import type { Appointment, BusinessHours, Org } from "@/lib/mock/types";

export const SAST_OFFSET = "+02:00";

/* ---- Time utilities (SAST, fixed offset) ------------------------------ */

/** Minutes since midnight for "HH:MM". */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * ISO weekday for a YYYY-MM-DD date, Monday = 1 … Sunday = 7. A calendar date's
 * weekday is timezone-independent, so we anchor at **UTC midnight**  anchoring
 * at SAST midnight would land on the previous UTC day and return the wrong day.
 */
export function isoWeekday(date: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0..6, Sun=0
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function instant(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00${SAST_OFFSET}`;
}

/* ---- Availability ----------------------------------------------------- */

export interface Slot {
  start: string; // ISODateTime
  label: string; // "09:30"
}

/**
 * Free start times for a counsellor on a date, honouring business hours,
 * breaks, an inter-session buffer, and existing bookings. The grid steps by the
 * service duration; a slot is offered only if the whole session **plus buffer**
 * fits before the next booking, a break, or close of business.
 */
export function availableSlots(opts: {
  org: Org;
  date: string;
  durationMin?: number;
  existing: readonly Appointment[];
}): Slot[] {
  const { org, date } = opts;
  const duration = opts.durationMin ?? org.scheduling.defaultDurationMin;
  const buffer = org.scheduling.bufferMin;
  const hours = org.scheduling.businessHours[isoWeekday(date)];
  if (!hours) return []; // closed that day

  const open = toMinutes(hours.start);
  const close = toMinutes(hours.end);
  const breaks = (hours.breaks ?? []).map((b) => ({
    start: toMinutes(b.start),
    end: toMinutes(b.end),
  }));

  // Booked windows for the day, padded by the buffer on each side.
  const booked = opts.existing
    .filter((a) => a.startsAt.startsWith(date) && isBlocking(a.state))
    .map((a) => {
      const start = minutesOfInstant(a.startsAt) - buffer;
      const end = minutesOfInstant(a.startsAt) + a.durationMin + buffer;
      return { start, end };
    });

  const blocked = [...breaks, ...booked];
  const slots: Slot[] = [];

  for (let t = open; t + duration <= close; t += duration) {
    const sessionEnd = t + duration;
    const clashes = blocked.some((w) => t < w.end && sessionEnd > w.start);
    if (!clashes) slots.push({ start: instant(date, fromMinutes(t)), label: fromMinutes(t) });
  }
  return slots;
}

function isBlocking(state: Appointment["state"]): boolean {
  return state === "scheduled" || state === "completed" || state === "risk_flagged";
}

function minutesOfInstant(iso: string): number {
  // Wall-clock minutes in SAST; the offset is fixed so this is exact.
  const time = iso.slice(11, 16);
  return toMinutes(time);
}

/* ---- Room utilisation ------------------------------------------------- */

export interface RoomUtilisation {
  meetings: number;
  bookedHours: number;
  /** Of business-day capacity over the window; honestly capped at 100. */
  utilisationPct: number;
  busiestDay: string | null;
}

export function roomUtilisation(opts: {
  appointments: readonly Appointment[];
  businessHours: BusinessHours;
  weekDates: readonly string[]; // the dates the window covers
}): RoomUtilisation {
  const { appointments, businessHours, weekDates } = opts;
  const inWindow = appointments.filter(
    (a) => a.roomId && isBlocking(a.state) && weekDates.some((d) => a.startsAt.startsWith(d)),
  );

  const bookedMinutes = inWindow.reduce((sum, a) => sum + a.durationMin, 0);

  // Capacity = sum of open minutes across the window's days.
  const capacityMinutes = weekDates.reduce((sum, d) => {
    const h = businessHours[isoWeekday(d)];
    if (!h) return sum;
    const open = toMinutes(h.end) - toMinutes(h.start);
    const breaks = (h.breaks ?? []).reduce(
      (b, br) => b + (toMinutes(br.end) - toMinutes(br.start)),
      0,
    );
    return sum + Math.max(0, open - breaks);
  }, 0);

  const byDay = new Map<string, number>();
  for (const a of inWindow) {
    const day = a.startsAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + a.durationMin);
  }
  let busiestDay: string | null = null;
  let busiestMinutes = -1;
  for (const [day, mins] of byDay) {
    if (mins > busiestMinutes) {
      busiestMinutes = mins;
      busiestDay = day;
    }
  }

  return {
    meetings: inWindow.length,
    bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
    utilisationPct:
      capacityMinutes === 0 ? 0 : Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100)),
    busiestDay,
  };
}

/* ---- K-anonymity + coverage (Outcome-Honesty Rule) -------------------- */

export const K_ANON_FLOOR = 5;

export interface CountRow {
  label: string;
  count: number;
}

/**
 * Suppress any cell below the k-anonymity floor so a funder/aggregate export can
 * never re-identify a small cohort. Suppressed cells are *labelled*, not dropped
 * silently ("too few to report")  honesty over a prettier chart.
 */
export function applyKAnon(rows: readonly CountRow[], floor: number = K_ANON_FLOOR) {
  return rows.map((r) => ({
    label: r.label,
    count: r.count >= floor ? r.count : null,
    suppressed: r.count < floor,
  }));
}

/** "412 of 530 measured"  distinguishes captured from missing data. */
export function coverageNote(captured: number, total: number, noun = "measured"): string {
  if (total === 0) return `none yet ${noun}`;
  return `${captured.toLocaleString("en-ZA")} of ${total.toLocaleString("en-ZA")} ${noun}`;
}
