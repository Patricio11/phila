"use client";

import { useState } from "react";
import { za } from "@/lib/format";
import { CalendarDays, CreditCard, HandCoins, TrendingUp, Users, Wallet } from "lucide-react";
import type { HubDashboard, DashPeriod } from "@/db/queries/hub-dashboard";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHead } from "@/components/ui/card";
import { BookingsChart } from "@/components/dashboard/bookings-chart";
import { cn } from "@/lib/utils";

/**
 * Feedback #3 - the period-driven dashboard block. One filter (Today · This
 * week · This month · Last month) drives the booking/revenue tiles, the
 * payment split, the compact client row, and the bookings chart. All periods
 * arrive precomputed, so switching is instant.
 */
const PERIODS: { key: DashPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

const rands = (cents: number) => `R${za(Math.round(cents / 100))}`;

export function HubDashboardStats({ data, paymentsOn, period: controlledPeriod, onPeriod }: {
  data: HubDashboard;
  paymentsOn: boolean;
  /** When supplied, the dashboard owns the period (one filter for every widget). */
  period?: DashPeriod;
  onPeriod?: (p: DashPeriod) => void;
}) {
  const [ownPeriod, setOwnPeriod] = useState<DashPeriod>("week");
  // Controlled by the dashboard when one filter drives every widget (batch 2m).
  const period = controlledPeriod ?? ownPeriod;
  const setPeriod = (p: DashPeriod) => (onPeriod ? onPeriod(p) : setOwnPeriod(p));
  const s = data.periods[period];
  const totalCents = s.receivedCents + s.projectedCents;

  return (
    <div className="space-y-3.5">
      {/* Period filter */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-control border border-border bg-surface p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
              className={cn("h-8 rounded-[6px] px-3 text-[12.5px] font-medium transition-colors", period === p.key ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Headline: bookings + money */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Bookings" value={s.bookings} coverage={`${s.completed} completed · ${s.noShows} no-show${s.noShows === 1 ? "" : "s"}`} />
        <StatCard icon={Wallet} label="Income received" value={rands(s.receivedCents)} coverage="paid invoices" />
        <StatCard icon={TrendingUp} label="Projected income" value={rands(s.projectedCents)} coverage="invoiced, not yet paid" />
        <StatCard icon={HandCoins} label="Total (approx.)" value={rands(totalCents)} coverage="received + projected" />
      </div>

      {/* How the money arrived */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <StatCard icon={CreditCard} label="Paid online" value={rands(s.onlineCents)} coverage={paymentsOn ? "via your payment gateway" : "gateway not connected"} />
        <StatCard icon={HandCoins} label="Cash / Card / EFT" value={rands(s.manualCents)} coverage="recorded by the practice" />
        <StatCard icon={Users} label="Clients seen" value={s.clientsSeen} coverage={`${s.newClients} new client${s.newClients === 1 ? "" : "s"}`} />
      </div>

      {/* Bookings over the period */}
      <Card>
        <CardHead title="Bookings" action={<span className="text-[11.5px] text-text-3">{PERIODS.find((p) => p.key === period)!.label.toLowerCase()}</span>} />
        <div className="px-[17px] pb-[17px]">
          <BookingsChart series={s.series} />
        </div>
      </Card>
    </div>
  );
}
