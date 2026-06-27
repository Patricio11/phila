import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * StatCard  DESIGN.md §6. A calm KPI card: the value leads, with a small tinted
 * icon set **beside** it (never stacked on top), an optional trend chip, and an
 * **honest coverage line** ("412 of 530 measured"). Never a vanity number: the
 * coverage caption distinguishes captured from missing data (Outcome-Honesty
 * Rule). For an "up is bad" metric (no-shows), set `invertTrend` so the colour
 * tells the truth. `icon` is optional; `tone` colours the value + icon for a
 * metric that should read as a warning (overdue, safeguarding).
 */
type Trend = { direction: "up" | "down" | "flat"; label: string };
type Tone = "default" | "warn" | "danger";

const VALUE_TONE: Record<Tone, string> = {
  default: "text-text",
  warn: "text-warn",
  danger: "text-danger",
};
const ICON_TONE: Record<Tone, string> = {
  default: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  coverage,
  trend,
  invertTrend = false,
  tone = "default",
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  coverage?: string;
  trend?: Trend;
  invertTrend?: boolean;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-3.5">
        {Icon ? (
          <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-chip", ICON_TONE[tone])}>
            <Icon className="size-[19px]" strokeWidth={1.9} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className={cn("text-[24px] font-bold leading-none tracking-[-0.03em] tabular-nums", VALUE_TONE[tone])}>{value}</div>
          <div className="mt-1.5 truncate text-[12.5px] font-medium text-text-2">{label}</div>
        </div>
        {trend ? <TrendChip trend={trend} invert={invertTrend} /> : null}
      </div>
      {coverage ? <div className="mt-2.5 text-[11.5px] text-text-3">{coverage}</div> : null}
    </Card>
  );
}

function TrendChip({ trend, invert }: { trend: Trend; invert: boolean }) {
  const good = trend.direction === "flat" ? "flat" : (trend.direction === "up") !== invert ? "good" : "bad";
  const tone = good === "good" ? "bg-accent-soft text-accent" : good === "bad" ? "bg-danger-soft text-danger" : "bg-surface-2 text-text-3";
  const TrendIcon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 self-start rounded-pill px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums", tone)}>
      <TrendIcon className="size-3" aria-hidden />
      {trend.label}
    </span>
  );
}
