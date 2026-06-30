/**
 * Pure analytics (Phase 16)  the M&E / reporting computation, extracted so the DB
 * provider can feed it REAL rows (no mock). Funder-facing aggregates are k-anon'd;
 * the Hub's own operational view keeps honest counts. Outcome measures arrive with a
 * real `takenAt`, bucketed into weeks-ago relative to `now`.
 */
import type {
  ReportingResult, ReportingFilters, Breakdown, OutcomePoint,
  HubInsights, InsightsFilters, InsightsPeriod, InsightsBar, InsightsMix,
  GrantBreakdowns, IndicatorActual,
} from "@/lib/data-provider";
import type { Demographics, Grant, GrantIndicator } from "@/lib/domain/types";
import type { IndicatorStatus } from "@/lib/data-provider";
import { applyKAnon } from "@/lib/domain/helpers";
import { GENDER_LABELS, POPULATION_GROUP_LABELS, AGE_BAND_LABELS, EMPLOYMENT_LABELS } from "@/lib/domain/labels";

// ── Row shapes the loaders provide ───────────────────────────────────────────
export interface ClientRow { id: string; createdAt: string }
export interface OutcomeRow { clientId: string; tool: string; score: number; takenAt: string }
export interface ApptRow { clientId: string; state: string; startsAt: string }
export interface InvoiceRow { status: string; issuedAt: string; amountCents: number }

const WEEK_MS = 7 * 86_400_000;

function weeksAgo(takenAt: string, now: string): number {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(takenAt).getTime()) / WEEK_MS));
}
function countBy<T>(rows: readonly T[], key: (r: T) => string): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
const toBreakdown = (rows: { label: string; count: number }[]): Breakdown[] => applyKAnon(rows);
const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 100));

/** PHQ-9 trend: average score per weeks-ago bucket, newest→… (the sparkline reads it). */
export function outcomeTrend(outcomes: OutcomeRow[], consentedIds: Set<string>, now: string): { points: OutcomePoint[]; coverage: { captured: number; total: number } } {
  const buckets = new Map<number, number[]>();
  const measured = new Set<string>();
  for (const o of outcomes) {
    if (o.tool !== "PHQ-9" || !consentedIds.has(o.clientId)) continue;
    measured.add(o.clientId);
    const w = weeksAgo(o.takenAt, now);
    const arr = buckets.get(w) ?? [];
    arr.push(o.score);
    buckets.set(w, arr);
  }
  const points: OutcomePoint[] = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, scores]) => ({ label: w === 0 ? "now" : `${w}w`, value: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) }));
  return { points, coverage: { captured: measured.size, total: consentedIds.size } };
}

/** Share (%) of clients whose first→latest PHQ-9 dropped ≥5 points (≥2 measures). */
export function pctImprovedPhq9(outcomes: OutcomeRow[], clientIds: Set<string>): number {
  const byClient = new Map<string, OutcomeRow[]>();
  for (const o of outcomes) {
    if (o.tool !== "PHQ-9" || !clientIds.has(o.clientId)) continue;
    (byClient.get(o.clientId) ?? byClient.set(o.clientId, []).get(o.clientId)!).push(o);
  }
  const series = [...byClient.values()].map((arr) => arr.slice().sort((a, b) => a.takenAt.localeCompare(b.takenAt))).filter((a) => a.length >= 2);
  const improved = series.filter((a) => a[0]!.score - a[a.length - 1]!.score >= 5);
  return pct(improved.length, series.length);
}

// ── Reporting (funder-facing demographic dashboard, k-anon) ──────────────────
export interface ReportingInput { clients: ClientRow[]; consentedIds: Set<string>; demographics: Demographics[]; outcomes: OutcomeRow[] }

export function computeReporting(input: ReportingInput, now: string, filters: ReportingFilters): ReportingResult & { improvementRate: number; headline: string[] } {
  const consentedDemos = input.demographics.filter((d) => input.consentedIds.has(d.clientId));
  let demos = consentedDemos;
  if (filters.province) demos = demos.filter((d) => d.province === filters.province);
  if (filters.gender) demos = demos.filter((d) => d.gender === filters.gender);
  if (filters.ageBand) demos = demos.filter((d) => d.ageBand === filters.ageBand);
  if (filters.employment) demos = demos.filter((d) => d.employmentStatus === filters.employment);

  const outcome = outcomeTrend(input.outcomes, input.consentedIds, now);
  const improvementRate = pctImprovedPhq9(input.outcomes, input.consentedIds);

  // Honest headline  the "what does this say" line funders actually want.
  const headline: string[] = [];
  const femaleShare = pct(consentedDemos.filter((d) => d.gender === "female").length, consentedDemos.length);
  const youthShare = pct(consentedDemos.filter((d) => ["under_18", "18_24"].includes(d.ageBand)).length, consentedDemos.length);
  if (consentedDemos.length) headline.push(`${input.consentedIds.size} consented for demographic reporting (${pct(input.consentedIds.size, input.clients.length)}% of ${input.clients.length}).`);
  if (femaleShare) headline.push(`${femaleShare}% of participants are women; ${youthShare}% are youth (under 25).`);
  if (outcome.points.length >= 2) {
    const drop = outcome.points[outcome.points.length - 1]!.value - outcome.points[0]!.value;
    if (drop > 0) headline.push(`Average PHQ-9 fell ${drop} points over the window; ${improvementRate}% improved ≥5.`);
  }

  return {
    totalClients: input.clients.length,
    withDemographics: input.consentedIds.size,
    matched: demos.length,
    byProvince: toBreakdown(countBy(demos, (d) => d.province)),
    byGender: toBreakdown(countBy(demos, (d) => GENDER_LABELS[d.gender as keyof typeof GENDER_LABELS] ?? d.gender)),
    byPopulationGroup: toBreakdown(countBy(demos, (d) => POPULATION_GROUP_LABELS[d.populationGroup as keyof typeof POPULATION_GROUP_LABELS] ?? d.populationGroup)),
    byAgeBand: toBreakdown(countBy(demos, (d) => AGE_BAND_LABELS[d.ageBand as keyof typeof AGE_BAND_LABELS] ?? d.ageBand)),
    byEmployment: toBreakdown(countBy(demos, (d) => EMPLOYMENT_LABELS[d.employmentStatus as keyof typeof EMPLOYMENT_LABELS] ?? d.employmentStatus)),
    outcome,
    improvementRate,
    headline,
  };
}

// ── Grant indicators (M&E engine) ────────────────────────────────────────────
export interface GrantComputeInput { allocatedIds: string[]; consentedIds: Set<string>; demographics: Demographics[]; outcomes: OutcomeRow[]; appointments: ApptRow[] }

export function periodElapsed(grant: Grant, nowISO: string): number {
  const start = new Date(`${grant.periodStart}T00:00:00Z`).getTime();
  const end = new Date(`${grant.periodEnd}T23:59:59Z`).getTime();
  const t = new Date(nowISO).getTime();
  if (t <= start || end <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

export function computeIndicator(ind: GrantIndicator, grant: Grant, input: GrantComputeInput, now: string): IndicatorActual {
  const allocated = input.allocatedIds;
  const consentedAllocated = allocated.filter((id) => input.consentedIds.has(id));
  const demos = input.demographics.filter((d) => consentedAllocated.includes(d.clientId));
  const allocatedSet = new Set(allocated);
  let actual = 0;

  switch (ind.metric) {
    case "unique_clients":
      actual = allocated.length; break;
    case "sessions_delivered":
      actual = input.appointments.filter((a) => allocatedSet.has(a.clientId) && ["completed", "discharged"].includes(a.state) && a.startsAt.slice(0, 10) >= grant.periodStart && a.startsAt.slice(0, 10) <= grant.periodEnd).length; break;
    case "pct_female":
      actual = pct(demos.filter((d) => d.gender === "female").length, demos.length); break;
    case "pct_employed":
      actual = pct(demos.filter((d) => d.employmentStatus === "employed").length, demos.length); break;
    case "pct_youth":
      actual = pct(demos.filter((d) => ["under_18", "18_24"].includes(d.ageBand)).length, demos.length); break;
    case "phq9_improved_5":
      actual = pctImprovedPhq9(input.outcomes, allocatedSet); break;
  }

  const isCount = ind.type === "count";
  const elapsed = periodElapsed(grant, now);
  const expected = isCount ? Math.round(ind.target * elapsed) : null;
  const ratio = isCount ? (expected && expected > 0 ? actual / expected : actual >= ind.target ? 1 : 0) : ind.target > 0 ? actual / ind.target : 1;
  const status: IndicatorStatus = ratio >= 0.9 ? "on_track" : ratio >= 0.7 ? "at_risk" : "behind";
  return { indicator: ind, actual, expected, status };
}

export function grantBreakdowns(consentedIds: Set<string>, allocatedIds: string[], demographics: Demographics[]): GrantBreakdowns {
  const set = new Set(allocatedIds.filter((id) => consentedIds.has(id)));
  const demos = demographics.filter((d) => set.has(d.clientId));
  return {
    byGender: toBreakdown(countBy(demos, (d) => GENDER_LABELS[d.gender as keyof typeof GENDER_LABELS] ?? d.gender)),
    byAgeBand: toBreakdown(countBy(demos, (d) => AGE_BAND_LABELS[d.ageBand as keyof typeof AGE_BAND_LABELS] ?? d.ageBand)),
    byProvince: toBreakdown(countBy(demos, (d) => d.province)),
  };
}

/** Honest one-line summary for a grant dashboard. */
export function grantHeadline(indicators: IndicatorActual[], periodElapsedPct: number): string {
  if (!indicators.length) return "No indicators set for this grant yet.";
  const onTrack = indicators.filter((i) => i.status === "on_track").length;
  const behind = indicators.filter((i) => i.status === "behind");
  const lead = `${onTrack} of ${indicators.length} indicators on track at ${periodElapsedPct}% of the period.`;
  if (behind.length) return `${lead} Behind: ${behind.map((i) => i.indicator.name).join(", ")}.`;
  return `${lead} Nothing behind pace.`;
}

// ── Hub insights (operational, honest counts, period deltas) ─────────────────
export interface InsightsInput { clients: ClientRow[]; consentedIds: Set<string>; demographics: Demographics[]; appointments: ApptRow[]; invoices: InvoiceRow[] }

function sastDate(nowISO: string): string {
  return new Date(new Date(nowISO).getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
function isoWeekRange(date: string): { from: string; to: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7; // Mon=0
  const from = addDays(date, -wd);
  return { from, to: addDays(from, 6) };
}
function monthOf(d: string): string { return d.slice(0, 7); }
function shiftMonth(mStr: string, delta: number): string {
  const [y, m] = mStr.split("-").map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1 + delta, 1)).toISOString().slice(0, 7);
}
function monthEnd(mStr: string): string {
  const [y, m] = mStr.split("-").map(Number);
  return new Date(Date.UTC(y as number, m as number, 0)).toISOString().slice(0, 10);
}

function windowFor(period: InsightsPeriod, today: string): { from: string; to: string } {
  const week = isoWeekRange(today);
  const month = monthOf(today);
  if (period === "week") return week;
  if (period === "month") return { from: `${month}-01`, to: monthEnd(month) };
  return { from: `${shiftMonth(month, -2)}-01`, to: monthEnd(month) };
}
function prevWindowFor(period: InsightsPeriod, today: string): { from: string; to: string } {
  const month = monthOf(today);
  if (period === "week") { const w = isoWeekRange(addDays(isoWeekRange(today).from, -1)); return w; }
  if (period === "month") { const pm = shiftMonth(month, -1); return { from: `${pm}-01`, to: monthEnd(pm) }; }
  return { from: `${shiftMonth(month, -5)}-01`, to: monthEnd(shiftMonth(month, -3)) };
}

export interface InsightsExtras { previous: { completed: number; attendanceRate: number; newClients: number; revenueActualCents: number; noShows: number } }

export function computeInsights(input: InsightsInput, now: string, filters: InsightsFilters): HubInsights & InsightsExtras {
  const period: InsightsPeriod = filters.period ?? "month";
  const nowMs = new Date(now).getTime();
  const today = sastDate(now);
  const week = isoWeekRange(today);
  const month = monthOf(today);

  const live = input.appointments.filter((a) => a.state !== "cancelled");
  const onDay = (d: string) => live.filter((a) => a.startsAt.startsWith(d)).length;
  const sessionsToday = onDay(today);
  const sessionsWeek = live.filter((a) => { const d = a.startsAt.slice(0, 10); return d >= week.from && d <= week.to; }).length;
  const sessionsMonth = live.filter((a) => a.startsAt.startsWith(month)).length;

  const stats = (win: { from: string; to: string }) => {
    const inWin = (iso: string) => { const d = iso.slice(0, 10); return d >= win.from && d <= win.to; };
    const wl = live.filter((a) => inWin(a.startsAt));
    const completed = wl.filter((a) => a.state === "completed" || a.state === "discharged").length;
    const noShows = wl.filter((a) => a.state === "no_show").length;
    return {
      completed, noShows,
      upcoming: wl.filter((a) => a.state === "scheduled" && new Date(a.startsAt).getTime() > nowMs).length,
      cancelled: input.appointments.filter((a) => a.state === "cancelled" && inWin(a.startsAt)).length,
      attendanceRate: completed + noShows === 0 ? 0 : Math.round((completed / (completed + noShows)) * 100),
      activeClients: new Set(wl.map((a) => a.clientId)).size,
      newClients: input.clients.filter((c) => inWin(c.createdAt)).length,
      revenueActualCents: input.invoices.filter((i) => i.status === "paid" && inWin(i.issuedAt)).reduce((s, i) => s + i.amountCents, 0),
    };
  };
  const cur = stats(windowFor(period, today));
  const prev = stats(prevWindowFor(period, today));

  const shortMonth = (mStr: string) => new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(new Date(`${mStr}-01T12:00:00Z`));
  const shortDay = (d: string) => new Intl.DateTimeFormat("en-ZA", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const byDay: InsightsBar[] = Array.from({ length: 7 }, (_, i) => addDays(week.from, i)).map((d) => ({ key: d, label: shortDay(d), count: onDay(d) }));
  const byMonth: InsightsBar[] = Array.from({ length: 6 }, (_, i) => shiftMonth(month, -(5 - i))).map((mStr) => ({ key: mStr, label: shortMonth(mStr), count: live.filter((a) => a.startsAt.startsWith(mStr)).length }));

  let demos = input.demographics.filter((d) => input.consentedIds.has(d.clientId));
  const withDemographics = demos.length;
  if (filters.gender) demos = demos.filter((d) => d.gender === filters.gender);
  if (filters.province) demos = demos.filter((d) => d.province === filters.province);
  if (filters.ageBand) demos = demos.filter((d) => d.ageBand === filters.ageBand);

  return {
    period, sessionsToday, sessionsWeek, sessionsMonth,
    completed: cur.completed, upcoming: cur.upcoming, cancelled: cur.cancelled, noShows: cur.noShows,
    attendanceRate: cur.attendanceRate, newClients: cur.newClients, activeClients: cur.activeClients, revenueActualCents: cur.revenueActualCents,
    byDay, byMonth,
    totalClients: input.clients.length, matchedClients: demos.length, withDemographics,
    byGender: countBy(demos, (d) => GENDER_LABELS[d.gender as keyof typeof GENDER_LABELS] ?? d.gender) as InsightsMix[],
    byAgeBand: countBy(demos, (d) => AGE_BAND_LABELS[d.ageBand as keyof typeof AGE_BAND_LABELS] ?? d.ageBand) as InsightsMix[],
    byProvince: countBy(demos, (d) => d.province) as InsightsMix[],
    previous: { completed: prev.completed, attendanceRate: prev.attendanceRate, newClients: prev.newClients, revenueActualCents: prev.revenueActualCents, noShows: prev.noShows },
  };
}
