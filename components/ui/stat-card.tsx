import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * StatCard — DESIGN.md §6. A tinted icon, an optional trend chip, a big tabular
 * value, a label, and an **honest coverage line** ("412 of 530 measured"). Never
 * a vanity number: the coverage caption distinguishes captured from missing data
 * (Outcome-Honesty Rule). For an "up is bad" metric (no-shows), set
 * `invertTrend` so the colour tells the truth, not just the direction.
 */
type Trend = { direction: "up" | "down" | "flat"; label: string };

export function StatCard({
  icon: Icon,
  label,
  value,
  coverage,
  trend,
  invertTrend = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  coverage?: string;
  trend?: Trend;
  invertTrend?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <span className="inline-flex size-9 items-center justify-center rounded-chip bg-accent-soft text-accent">
          <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </span>
        {trend ? <TrendChip trend={trend} invert={invertTrend} /> : null}
      </div>

      <div className="mt-3.5 text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums text-text">
        {value}
      </div>
      <div className="mt-1.5 text-[13px] font-medium text-text-2">{label}</div>
      {coverage ? (
        <div className="mt-1 text-[11.5px] text-text-3">{coverage}</div>
      ) : null}
    </Card>
  );
}

function TrendChip({ trend, invert }: { trend: Trend; invert: boolean }) {
  const good =
    trend.direction === "flat"
      ? "flat"
      : (trend.direction === "up") !== invert
        ? "good"
        : "bad";

  const tone =
    good === "good"
      ? "bg-accent-soft text-accent"
      : good === "bad"
        ? "bg-danger-soft text-danger"
        : "bg-surface-2 text-text-3";

  const TrendIcon =
    trend.direction === "up"
      ? ArrowUpRight
      : trend.direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums",
        tone,
      )}
    >
      <TrendIcon className="size-3" aria-hidden />
      {trend.label}
    </span>
  );
}
