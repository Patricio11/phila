/**
 * Pure dashboard aggregations (Phase 10). Extracted so the mock and DB providers
 * compute the *same* numbers from the same primitives  the mock passes
 * fixture/materialised data, `dbProvider` passes rows from Postgres. Both call
 * these, so the Hub/counsellor home pages are identical whichever source is live,
 * and the maths is unit-tested directly (deterministic in, deterministic out).
 *
 * Date logic uses `slice(0,10)` / `startsWith` on the ISO `startsAt`, which agrees
 * for both the mock's `+02:00` strings and the DB's UTC strings across business
 * hours (08:00–17:00 SAST → 06:00–15:00 UTC, no midnight crossing).
 */
import type { HubOverview, AttentionItem, AppointmentView, CounsellorDashboard, OutcomePoint } from "@/lib/data-provider";
import type { Appointment, Client, Counsellor, Invoice, Org, Service } from "@/lib/domain/types";

function sastDate(nowISO: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowISO));
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoWeekRange(date: string): { from: string; to: string } {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const from = addDays(date, mondayOffset);
  return { from, to: addDays(from, 6) };
}

export interface HubOverviewInput {
  counsellors: Counsellor[];
  clients: Client[]; // live only (soft-deletes excluded)
  appointments: Appointment[]; // all org appointments, any state
  invoices: Invoice[];
  services: Service[];
  measuredClientIds: Set<string>; // clients with ≥1 outcome measure
  now: string;
}

export function computeHubOverview(input: HubOverviewInput): HubOverview {
  const { counsellors, clients, appointments: appts, invoices, services, measuredClientIds, now } = input;
  const nowMs = new Date(now).getTime();
  const today = sastDate(now);
  const week = isoWeekRange(today);
  const month = today.slice(0, 7);

  const live = appts.filter((a) => a.state !== "cancelled");
  const inWk = (iso: string) => { const d = iso.slice(0, 10); return d >= week.from && d <= week.to; };
  const clientsToday = new Set(live.filter((a) => a.startsAt.startsWith(today)).map((a) => a.clientId)).size;
  const inWeek = live.filter((a) => inWk(a.startsAt));
  const clientsWeek = new Set(inWeek.map((a) => a.clientId)).size;
  const clientsMonth = new Set(live.filter((a) => a.startsAt.startsWith(month)).map((a) => a.clientId)).size;

  const priceOf = (serviceId: string) => services.find((x) => x.id === serviceId)?.priceCents ?? 0;
  const paidSum = (pred: (iso: string) => boolean) =>
    invoices.filter((i) => i.status === "paid" && pred(i.issuedAt)).reduce((s, i) => s + i.amountCents, 0);
  const futureSum = (pred: (iso: string) => boolean) =>
    appts.filter((a) => a.state === "scheduled" && new Date(a.startsAt).getTime() > nowMs && pred(a.startsAt)).reduce((s, a) => s + priceOf(a.serviceId), 0);
  const inDay = (iso: string) => iso.startsWith(today);

  const incomeMonthCents = paidSum((iso) => iso.startsWith(month));
  const incomeTodayCents = paidSum(inDay);
  const incomeWeekCents = paidSum(inWk);
  const income = {
    todayCents: incomeTodayCents,
    weekCents: incomeWeekCents,
    predictedTodayCents: incomeTodayCents + futureSum(inDay),
    predictedWeekCents: incomeWeekCents + futureSum(inWk),
  };

  const newClientsToday = clients.filter((c) => c.createdAt.startsWith(today)).length;
  const newClientsWeek = clients.filter((c) => inWk(c.createdAt)).length;
  const newClientsMonth = clients.filter((c) => c.createdAt.startsWith(month)).length;

  const heldWeek = inWeek.filter((a) => ["completed", "no_show", "risk_flagged"].includes(a.state));
  const noShows = inWeek.filter((a) => a.state === "no_show").length;
  const noShowRate = heldWeek.length === 0 ? 0 : Math.round((noShows / heldWeek.length) * 100);

  const pendingCredentials = counsellors.filter((c) => ["pending", "unverified"].includes(c.credential.status)).length;
  const seenClients = new Set(appts.filter((a) => a.state === "completed" || a.state === "discharged").map((a) => a.clientId));
  const openIntakes = clients.filter((c) => !seenClients.has(c.id)).length;
  const measured = clients.filter((c) => measuredClientIds.has(c.id)).length;

  const attention: AttentionItem[] = [];
  for (const c of clients) {
    if (c.riskFlag) attention.push({ id: `risk_${c.id}`, tone: "rose", title: `Safeguarding  ${c.name}`, detail: "A counsellor has flagged a safeguarding concern.", href: "/hub/clients" });
  }
  if (pendingCredentials > 0) {
    attention.push({ id: "creds", tone: "amber", title: `${pendingCredentials} credential ${pendingCredentials === 1 ? "check" : "checks"} pending`, detail: "Verify HPCSA / ASCHP / SACSSP registration before clients are assigned.", href: "/hub/team" });
  }

  return {
    clientsToday, clientsWeek, clientsMonth,
    newClientsToday, newClientsWeek, newClientsMonth,
    incomeMonthCents,
    incomePredictionCents: incomeMonthCents + futureSum((iso) => iso.startsWith(month)),
    income, noShowRate, openIntakes, pendingCredentials,
    outcomesCoverage: { captured: measured, total: clients.length },
    attention,
  };
}

function buildAttention(todays: AppointmentView[], week: Appointment[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const a of todays) {
    if (a.state === "risk_flagged") {
      items.push({ id: `risk_${a.id}`, tone: "rose", title: `Safeguarding flag  ${a.clientName}`, detail: "Review with your supervisor. SADAG crisis line: 0800 567 567 (or SMS 31393).", href: `/app/sessions/${a.id}` });
    }
  }
  const missed = week.find((a) => a.state === "no_show");
  if (missed) items.push({ id: `missed_${missed.id}`, tone: "amber", title: "Missed session to follow up", detail: "A client did not attend this week  reach out to rebook." });
  return items;
}

export interface CounsellorDashboardInput {
  counsellor: Counsellor;
  org: Org;
  appointments: AppointmentView[]; // all the counsellor's appts, names resolved
  counsellorClients: Client[];
  measuredClientIds: Set<string>;
  outcomePoints: OutcomePoint[];
  now: string;
}

export function computeCounsellorDashboard(input: CounsellorDashboardInput): CounsellorDashboard {
  const { counsellor, org, appointments, counsellorClients, measuredClientIds, outcomePoints, now } = input;
  const today = sastDate(now);
  const week = isoWeekRange(today);
  const inWk = (iso: string) => { const d = iso.slice(0, 10); return d >= week.from && d <= week.to; };

  const todays = appointments.filter((a) => a.startsAt.startsWith(today)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const weekAppts = appointments.filter((a) => inWk(a.startsAt));
  const measured = counsellorClients.filter((c) => measuredClientIds.has(c.id)).length;
  const noShows = weekAppts.filter((a) => a.state === "no_show").length;
  const heldOrMissed = weekAppts.filter((a) => ["completed", "no_show", "risk_flagged"].includes(a.state)).length;

  return {
    org,
    counsellor,
    today: todays,
    stats: {
      clientsToday: new Set(todays.map((a) => a.clientId)).size,
      completedToday: todays.filter((a) => a.state === "completed").length,
      sessionsThisWeek: weekAppts.filter((a) => ["scheduled", "completed", "risk_flagged"].includes(a.state)).length,
      outcomesCoverage: { captured: measured, total: counsellorClients.length },
      noShowRate: { rate: heldOrMissed === 0 ? 0 : Math.round((noShows / heldOrMissed) * 100), window: "this week" },
    },
    outcomes: { tool: "PHQ-9", points: outcomePoints, coverage: { captured: measured, total: counsellorClients.length } },
    attention: buildAttention(todays, weekAppts),
  };
}
