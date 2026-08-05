import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments, invoices, payments, clients, services, counsellors, auditLog, user } from "@/db/schema";

/**
 * Feedback #3 — the period-driven hub dashboard. One fetch computes every
 * period (Today / This week / This month / Last month) so the client-side
 * filter switches instantly. Revenue is honest and derived:
 *   received  = paid invoices for the period's sessions
 *   online    = the paid ones settled through the org's gateway (payments row)
 *   manual    = the paid ones recorded by hand (cash / EFT)
 *   projected = the period's unpaid, uncancelled invoices
 */

export type DashPeriod = "today" | "week" | "month" | "lastMonth";

export interface PeriodStats {
  bookings: number;
  completed: number;
  noShows: number;
  clientsSeen: number;
  newClients: number;
  receivedCents: number;
  onlineCents: number;
  manualCents: number;
  projectedCents: number;
  /** The bookings chart series for this period (label + count per bucket). */
  series: { label: string; count: number }[];
}

export interface UpcomingRow {
  id: string;
  startsAt: string;
  clientName: string;
  serviceName: string;
  counsellorName: string;
  durationMin: number;
  priceCents: number | null;
  type: string;
}

export interface ActivityRow {
  action: string;
  reason: string | null;
  target: string;
  actorName: string | null;
  at: string;
}

export interface HubDashboard {
  periods: Record<DashPeriod, PeriodStats>;
  upcoming: UpcomingRow[];
  activity: ActivityRow[];
}

/* SAST wall-clock helpers (no DST in South Africa). */
const SAST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" });
const sastDay = (d: Date) => SAST_DAY.format(d);
const utcOf = (sastDate: string, time = "00:00") => new Date(`${sastDate}T${time}:00+02:00`);
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoWeekdayOf(date: string): number {
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export async function getHubDashboardDb(orgId: string, nowISO: string): Promise<HubDashboard> {
  const db = getDb();
  const now = new Date(nowISO);
  const today = sastDay(now);

  const weekStart = addDays(today, -(isoWeekdayOf(today) - 1));
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
  const bounds: Record<DashPeriod, { from: string; to: string }> = {
    today: { from: today, to: addDays(today, 1) },
    week: { from: weekStart, to: addDays(weekStart, 7) },
    month: { from: monthStart, to: addDays(`${today.slice(0, 7)}-28`, 4).slice(0, 7) + "-01" },
    lastMonth: { from: lastMonthStart, to: monthStart },
  };
  const windowFrom = utcOf(lastMonthStart < weekStart ? lastMonthStart : weekStart);
  const windowToStr = [bounds.month.to, bounds.week.to].sort().at(-1)!;
  const windowTo = utcOf(windowToStr);

  // One window of appointments covers every period.
  const appts = await db
    .select({ id: appointments.id, clientId: appointments.clientId, startsAt: appointments.startsAt, state: appointments.state })
    .from(appointments)
    .where(and(eq(appointments.orgId, orgId), gte(appointments.startsAt, windowFrom), lte(appointments.startsAt, windowTo)));

  const invRows = await db
    .select({ id: invoices.id, amountCents: invoices.amountCents, status: invoices.status, issuedAt: invoices.issuedAt })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), gte(invoices.issuedAt, windowFrom), lte(invoices.issuedAt, windowTo)));
  const invoiceIds = invRows.map((i) => i.id);
  const onlinePaid = new Set(
    invoiceIds.length
      ? (await db.select({ invoiceId: payments.invoiceId }).from(payments)
          .where(and(eq(payments.orgId, orgId), eq(payments.purpose, "invoice"), eq(payments.status, "paid"), inArray(payments.invoiceId, invoiceIds))))
          .map((p) => p.invoiceId)
      : [],
  );

  const clientRows = await db.select({ id: clients.id, createdAt: clients.createdAt }).from(clients)
    .where(and(eq(clients.orgId, orgId), gte(clients.createdAt, windowFrom)));

  const compute = (p: DashPeriod): PeriodStats => {
    const { from, to } = bounds[p];
    const inPeriod = appts.filter((a) => { const d = sastDay(a.startsAt); return d >= from && d < to; });
    const live = inPeriod.filter((a) => a.state !== "cancelled");
    let received = 0, online = 0, manual = 0, projected = 0;
    for (const inv of invRows) {
      const d = sastDay(inv.issuedAt);
      if (d < from || d >= to) continue;
      if (inv.status === "paid") { received += inv.amountCents; if (onlinePaid.has(inv.id)) online += inv.amountCents; else manual += inv.amountCents; }
      else if (inv.status === "unpaid") projected += inv.amountCents;
    }
    // Chart buckets: hours for Today, days otherwise.
    const series: { label: string; count: number }[] = [];
    if (p === "today") {
      for (let h = 6; h <= 20; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        series.push({ label, count: live.filter((a) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(a.startsAt)) === h).length });
      }
    } else {
      for (let d = from; d < to; d = addDays(d, 1)) {
        series.push({ label: p === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][isoWeekdayOf(d) - 1]! : d.slice(8), count: live.filter((a) => sastDay(a.startsAt) === d).length });
      }
    }
    return {
      bookings: live.length,
      completed: inPeriod.filter((a) => a.state === "completed" || a.state === "discharged").length,
      noShows: inPeriod.filter((a) => a.state === "no_show").length,
      clientsSeen: new Set(inPeriod.filter((a) => a.state === "completed" || a.state === "discharged").map((a) => a.clientId)).size,
      newClients: clientRows.filter((c) => { const d = sastDay(c.createdAt); return d >= from && d < to; }).length,
      receivedCents: received, onlineCents: online, manualCents: manual, projectedCents: projected,
      series,
    };
  };

  // Coming up next — the practice's next five sessions.
  const upcomingRows = await db
    .select({ a: appointments, clientName: clients.name, serviceName: services.name, priceCents: services.priceCents, counsellorName: counsellors.name })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.state, "scheduled"), gte(appointments.startsAt, now)))
    .orderBy(appointments.startsAt)
    .limit(5);

  // Activity feed — the org's own audit trail, minus read-noise.
  const activityRows = await db
    .select({ action: auditLog.action, reason: auditLog.reason, target: auditLog.target, actorName: user.name, at: auditLog.at })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorUserId, user.id))
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.at))
    .limit(60);
  const activity = activityRows
    .filter((r) => !["pii.read", "note.read", "note.read_hub_override", "demographics.read", "funder.view", "file.access"].includes(r.action))
    // Page-view reads are "who looked", not "what happened" — same rule as above.
    .filter((r) => !["view_member"].includes(r.reason ?? ""))
    .slice(0, 12)
    .map((r) => ({ action: r.action, reason: r.reason, target: r.target, actorName: r.actorName, at: r.at.toISOString() }));

  return {
    periods: { today: compute("today"), week: compute("week"), month: compute("month"), lastMonth: compute("lastMonth") },
    upcoming: upcomingRows.map((r) => ({
      id: r.a.id, startsAt: r.a.startsAt.toISOString(), clientName: r.clientName ?? "Client",
      serviceName: r.serviceName ?? "Session", counsellorName: r.counsellorName ?? "Counsellor",
      durationMin: r.a.durationMin, priceCents: r.priceCents, type: r.a.type,
    })),
    activity,
  };
}
