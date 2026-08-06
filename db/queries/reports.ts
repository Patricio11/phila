import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { appointments, clients, counsellors, services, rooms, invoices } from "@/db/schema";

/**
 * Operational reports (batch 2c) - Picktime-style: pick a report type + period,
 * get the honest table, export it. Everything derives from the permanent
 * appointment + invoice records; no clinical content ever appears here.
 */

export const REPORT_TYPES = [
  "bookings", "cancelled", "no_shows", "by_counsellor", "by_service", "payments_paid", "payments_pending",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  bookings: "Bookings summary",
  cancelled: "Cancelled bookings",
  no_shows: "No-shows",
  by_counsellor: "Bookings by counsellor",
  by_service: "Bookings by service",
  payments_paid: "Fully paid invoices",
  payments_pending: "Payment pending / unpaid",
};

export interface OperationalReport {
  type: ReportType;
  headers: string[];
  rows: string[][];
  /** One honest line under the table - counts + rand totals. */
  summary: string;
}

const R = (cents: number) => `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
const DAY = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" });
const STATE_WORD: Record<string, string> = {
  scheduled: "Scheduled", completed: "Completed", no_show: "No-show", cancelled: "Cancelled",
  rescheduled: "Rescheduled", postponed: "Postponed", discharged: "Discharged", risk_flagged: "Safeguarding",
};
const WHERE_WORD = (type: string, room: string | null) =>
  type === "online" ? "Online" : type === "hybrid" ? `Hybrid · ${room ?? "room"}` : room ?? "In person";

export async function operationalReportDb(orgId: string, type: ReportType, fromISO: string, toISO: string): Promise<OperationalReport> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const from = new Date(fromISO);
    const to = new Date(toISO);

    if (type === "payments_paid" || type === "payments_pending") {
      const rows = await db
        .select({ inv: invoices, clientName: clients.name })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .where(and(eq(invoices.orgId, orgId), gte(invoices.issuedAt, from), lt(invoices.issuedAt, to)));
      const wanted = rows
        .filter((r) => (type === "payments_paid" ? r.inv.status === "paid" : r.inv.status === "unpaid"))
        .sort((a, b) => b.inv.issuedAt.getTime() - a.inv.issuedAt.getTime());
      const nowMs = Date.now();
      const total = wanted.reduce((s, r) => s + r.inv.amountCents, 0);
      return {
        type,
        headers: ["Invoice", "Client", "Service", "Amount", "Issued", "Due", ...(type === "payments_pending" ? ["Overdue"] : [])],
        rows: wanted.map((r) => [
          r.inv.number, r.clientName ?? "Client", r.inv.serviceName, R(r.inv.amountCents),
          DAY.format(r.inv.issuedAt), DAY.format(r.inv.dueAt),
          ...(type === "payments_pending" ? [r.inv.dueAt.getTime() < nowMs ? "Yes" : ""] : []),
        ]),
        summary: `${wanted.length} invoice${wanted.length === 1 ? "" : "s"} · ${R(total)} ${type === "payments_paid" ? "collected" : "outstanding"}`,
      };
    }

    const rows = await db
      .select({ a: appointments, clientName: clients.name, counsellorName: counsellors.name, serviceName: services.name, roomName: rooms.name, priceCents: services.priceCents, invNumber: invoices.number, invStatus: invoices.status })
      .from(appointments)
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(rooms, eq(appointments.roomId, rooms.id))
      .leftJoin(invoices, eq(invoices.appointmentId, appointments.id))
      .where(and(eq(appointments.orgId, orgId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)));
    const sorted = rows.sort((a, b) => a.a.startsAt.getTime() - b.a.startsAt.getTime());

    if (type === "by_counsellor" || type === "by_service") {
      const keyOf = (r: (typeof rows)[number]) => (type === "by_counsellor" ? (r.counsellorName ?? "Counsellor") : (r.serviceName ?? "Session"));
      const groups = new Map<string, (typeof rows)[number][]>();
      for (const r of sorted) {
        const k = keyOf(r);
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      const grouped = [...groups.entries()].map(([name, g]) => {
        const live = g.filter((r) => r.a.state !== "cancelled");
        const completed = g.filter((r) => ["completed", "discharged"].includes(r.a.state));
        const billed = g.reduce((s, r) => s + (r.invNumber ? (r.priceCents ?? 0) : 0), 0);
        const paid = g.filter((r) => r.invStatus === "paid").reduce((s, r) => s + (r.priceCents ?? 0), 0);
        return {
          name,
          row: [
            name, String(live.length), String(completed.length),
            String(g.filter((r) => r.a.state === "no_show").length),
            String(g.filter((r) => r.a.state === "cancelled").length),
            `${Math.round(live.reduce((s, r) => s + r.a.durationMin, 0) / 6) / 10}h`,
            R(billed), R(paid),
          ],
          count: live.length,
        };
      }).sort((a, b) => b.count - a.count);
      return {
        type,
        headers: [type === "by_counsellor" ? "Counsellor" : "Service", "Booked", "Completed", "No-shows", "Cancelled", "Hours", "Billed", "Collected"],
        rows: grouped.map((g) => g.row),
        summary: `${grouped.length} ${type === "by_counsellor" ? "counsellors" : "services"} · ${sorted.filter((r) => r.a.state !== "cancelled").length} bookings in the period`,
      };
    }

    const filtered = type === "cancelled"
      ? sorted.filter((r) => r.a.state === "cancelled")
      : type === "no_shows"
        ? sorted.filter((r) => r.a.state === "no_show")
        : sorted;

    return {
      type,
      headers: ["Date", "Time", "Client", "Counsellor", "Service", "Where", "Status", "Price", "Invoice",
        ...(type === "cancelled" ? ["Reason"] : [])],
      rows: filtered.map((r) => [
        DAY.format(r.a.startsAt), TIME.format(r.a.startsAt),
        r.clientName ?? "Client", r.counsellorName ?? "", r.serviceName ?? "Session",
        r.a.heldByPhone ? `Phone call${r.a.callDurationMin ? ` (${r.a.callDurationMin} min)` : ""}` : WHERE_WORD(r.a.type, r.roomName),
        STATE_WORD[r.a.state] ?? r.a.state,
        r.priceCents != null ? R(r.priceCents) : "",
        r.invNumber ? `${r.invNumber} (${r.invStatus})` : "",
        ...(type === "cancelled" ? [r.a.cancelReason ?? ""] : []),
      ]),
      summary: `${filtered.length} booking${filtered.length === 1 ? "" : "s"}${type === "bookings" ? ` · ${filtered.filter((r) => ["completed", "discharged"].includes(r.a.state)).length} completed · ${filtered.filter((r) => r.a.state === "no_show").length} no-shows` : ""}`,
    };
  });
}
