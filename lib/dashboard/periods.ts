import type { DashPeriod } from "@/db/queries/hub-dashboard";

/**
 * The dashboard's four periods, as real SAST date windows - the same bounds the
 * stat tiles use, so one filter drives the tiles AND the widgets beneath them.
 */
export const DASH_PERIODS: { key: DashPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

const SAST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" });

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoWeekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
/** SAST wall-clock midnight for a date, as a UTC instant (+02:00, no DST). */
const utcOf = (date: string) => new Date(`${date}T00:00:00+02:00`);

export interface PeriodWindow { from: Date; to: Date; label: string }

/** [from, to) instants per period. */
export function periodWindows(nowISO: string): Record<DashPeriod, PeriodWindow> {
  const today = SAST_DAY.format(new Date(nowISO));
  const weekStart = addDays(today, -(isoWeekdayOf(today) - 1));
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonthStart = addDays(`${today.slice(0, 7)}-28`, 4).slice(0, 7) + "-01";
  const lastMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
  return {
    today: { from: utcOf(today), to: utcOf(addDays(today, 1)), label: "today" },
    week: { from: utcOf(weekStart), to: utcOf(addDays(weekStart, 7)), label: "this week" },
    month: { from: utcOf(monthStart), to: utcOf(nextMonthStart), label: "this month" },
    lastMonth: { from: utcOf(lastMonthStart), to: utcOf(monthStart), label: "last month" },
  };
}

/** Is an instant inside the window? */
export function inWindow(iso: string, w: PeriodWindow): boolean {
  const t = new Date(iso).getTime();
  return t >= w.from.getTime() && t < w.to.getTime();
}
