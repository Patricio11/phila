"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CalendarClock, CalendarDays, Coins, UserPlus, UserRound } from "lucide-react";
import type { HubInsights, InsightsFilters, InsightsBar, InsightsMix } from "@/lib/data-provider";
import { AGE_BANDS, GENDERS, PROVINCES } from "@/lib/domain/enums";
import { AGE_BAND_LABELS, GENDER_LABELS } from "@/lib/domain/labels";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Select } from "@/components/ui/select";
import { FilterMenu } from "@/components/ui/filter-menu";
import { DonutChart } from "@/components/charts/donut-chart";
import { coverageNote } from "@/lib/domain/helpers";
import { runInsights } from "@/app/hub/insights/actions";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "Last 3 months" },
];

const rands = (cents: number) => `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;

/** Period-over-period delta for a StatCard trend chip (Phase 16). */
function trend(cur: number, prev: number | undefined, fmt: (n: number) => string = (n) => `${n > 0 ? "+" : ""}${n}`): { direction: "up" | "down" | "flat"; label: string } | undefined {
  if (prev === undefined) return undefined;
  const d = cur - prev;
  if (d === 0) return { direction: "flat", label: "same as last" };
  return { direction: d > 0 ? "up" : "down", label: `${fmt(d)} vs last` };
}

export function HubInsightsView({ initial }: { initial: HubInsights }) {
  const [data, setData] = useState<HubInsights>(initial);
  const [filters, setFilters] = useState<InsightsFilters>({ period: initial.period });
  const [pending, start] = useTransition();

  const update = (patch: InsightsFilters) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    start(async () => setData(await runInsights(next)));
  };

  const filtered = Boolean(filters.gender || filters.province || filters.ageBand);

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
      {/* Session volumes  the at-a-glance the Hub was missing */}
      <div className="grid grid-cols-3 gap-3.5">
        <StatCard icon={CalendarCheck} label="Sessions today" value={data.sessionsToday} />
        <StatCard icon={CalendarDays} label="This week" value={data.sessionsWeek} />
        <StatCard icon={CalendarClock} label="This month" value={data.sessionsMonth} />
      </div>

      {/* Period switch */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text">How it&apos;s going</h2>
        <div className="w-44"><Select value={data.period} options={PERIODS} onChange={(v) => update({ period: v as InsightsFilters["period"] })} /></div>
      </div>

      {/* Operational metrics for the period  with period-over-period trend chips */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={UserRound} label="Sessions completed" value={data.completed} coverage={`${data.upcoming} still upcoming`} trend={trend(data.completed, data.previous?.completed)} />
        <StatCard icon={CalendarCheck} label="Attendance" value={`${data.attendanceRate}%`} coverage={`${data.noShows} no-show${data.noShows === 1 ? "" : "s"} · ${data.cancelled} cancelled`} trend={trend(data.attendanceRate, data.previous?.attendanceRate, (n) => `${n > 0 ? "+" : ""}${n}pts`)} />
        <StatCard icon={UserPlus} label="New clients" value={data.newClients} coverage={`${data.activeClients} active this period`} trend={trend(data.newClients, data.previous?.newClients)} />
        <StatCard icon={Coins} label="Revenue (paid)" value={rands(data.revenueActualCents)} coverage="received this period" trend={trend(data.revenueActualCents, data.previous?.revenueActualCents, (n) => `${n > 0 ? "+" : ""}${rands(Math.abs(n)).replace("R", n < 0 ? "-R" : "R")}`)} />
      </div>

      {/* Trends + session mix */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="Sessions this week" />
          <div className="px-[17px] pb-[17px]"><Bars bars={data.byDay} /></div>
        </Card>
        <Card>
          <CardHead title="Session mix this period" />
          <div className="px-[17px] pb-[20px] pt-1">
            <DonutChart
              data={[
                { label: "Completed", value: data.completed },
                { label: "Upcoming", value: data.upcoming },
                { label: "No-show", value: data.noShows, muted: true },
                { label: "Cancelled", value: data.cancelled, muted: true },
              ]}
              centerLabel={data.completed + data.upcoming + data.noShows + data.cancelled}
              centerCaption="sessions"
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Sessions by month" />
        <div className="px-[17px] pb-[17px]"><Bars bars={data.byMonth} /></div>
      </Card>

      {/* Client mix */}
      <Card>
        <CardHead
          title="Your clients"
          action={
            <span className="text-[12px] text-text-3">
              {filtered ? `${data.matchedClients} match` : coverageNote(data.withDemographics, data.totalClients, "shared demographics")}
            </span>
          }
        />
        <div className="space-y-4 px-[17px] pb-[17px]">
          <div className="flex flex-wrap gap-2">
            <FilterMenu label="Gender" value={filters.gender} onChange={(v) => update({ gender: v })} options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))} />
            <FilterMenu label="Age" value={filters.ageBand} onChange={(v) => update({ ageBand: v })} options={AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABELS[a] }))} />
            <FilterMenu label="Location" value={filters.province} onChange={(v) => update({ province: v })} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <MixDonut title="By gender" rows={data.byGender} />
            <MixDonut title="By age" rows={data.byAgeBand} />
            <MixDonut title="By location" rows={data.byProvince} />
          </div>
          <p className="border-t border-border pt-3 text-[11.5px] text-text-3">
            Your own clients, counted from those who consented to share demographics (POPIA). Internal to your practice  funder reports are separately k-anonymised in the Funder reporting tab.
          </p>
        </div>
      </Card>

      {/* Where clients come from (W7 referral tracking) — only when the org captures it. */}
      {data.byReferralSource && data.byReferralSource.length > 0 && (
        <Card>
          <CardHead
            title="Where clients come from"
            action={<span className="text-[12px] text-text-3">{data.byReferralSource.reduce((s, r) => s + r.count, 0)} with a source</span>}
          />
          <div className="space-y-2 px-[17px] pb-[17px]">
            <SourceBars rows={data.byReferralSource} />
            <p className="border-t border-border pt-3 text-[11.5px] text-text-3">
              How your clients found you  captured when you add or edit a client. Not demographic; no consent needed. Turn this off any time in Settings.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function Bars({ bars }: { bars: InsightsBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <div>
      {/* Fixed-height plot area so the flex columns actually get height. */}
      <div className="flex h-[120px] items-end gap-2.5">
        {bars.map((b) => (
          <div key={b.key} className="flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[5px] bg-accent/85 transition-[height] duration-300 hover:bg-accent"
              style={{ height: b.count > 0 ? `${Math.max(3, (b.count / max) * 100)}%` : 0 }}
              title={`${b.label}: ${b.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2.5">
        {bars.map((b) => (
          <div key={b.key} className="flex flex-1 flex-col items-center">
            <span className="text-[11px] font-medium tabular-nums text-text">{b.count}</span>
            <span className="text-[10.5px] text-text-3">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A ranked bar list for referral sources (clearer than a many-slice donut). */
function SourceBars({ rows }: { rows: InsightsMix[] }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {sorted.map((r) => (
        <li key={r.label} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3">
          <span className="truncate text-[12.5px] text-text-2">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
          </span>
          <span className="text-right text-[12.5px] font-semibold tabular-nums text-text">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function MixDonut({ title, rows }: { title: string; rows: InsightsMix[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div>
      <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">{title}</div>
      <DonutChart data={rows.map((r) => ({ label: r.label, value: r.count }))} centerLabel={total} centerCaption="clients" size={112} thickness={14} />
    </div>
  );
}
