import type { IndicatorActual, IndicatorStatus } from "@/lib/data-provider";
import { cn } from "@/lib/utils";

/**
 * IndicatorMeter (DESIGN.md §6)  an indicator's actual vs target with an honest
 * on-track / at-risk / behind classification. For count indicators the actual is
 * paced against the period (a marker shows what's expected by now); the actual is
 * always **computed from the clinical work**, never typed.
 */
const STATUS: Record<IndicatorStatus, { label: string; bar: string; chip: string }> = {
  on_track: { label: "On track", bar: "bg-accent", chip: "bg-accent-soft text-accent" },
  at_risk: { label: "At risk", bar: "bg-warn", chip: "bg-warn-soft text-warn" },
  behind: { label: "Behind", bar: "bg-danger", chip: "bg-danger-soft text-danger" },
};

export function IndicatorMeter({ item }: { item: IndicatorActual }) {
  const { indicator, actual, expected, status } = item;
  const isPct = indicator.unit === "%";
  const suffix = isPct ? "%" : "";
  const pct = indicator.target > 0 ? Math.min(100, (actual / indicator.target) * 100) : 0;
  const expectedPct = expected != null && indicator.target > 0 ? Math.min(100, (expected / indicator.target) * 100) : null;
  const s = STATUS[status];

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-[600] text-text">{indicator.name}</div>
          <div className="mt-0.5 text-[11.5px] text-text-3">{indicator.rule}</div>
        </div>
        <span className={cn("shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold", s.chip)}>{s.label}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[24px] font-bold tabular-nums leading-none text-text">
          {actual}
          {suffix}
        </span>
        <span className="text-[13px] text-text-3">
          / {indicator.target}
          {suffix} target
        </span>
      </div>

      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all", s.bar)} style={{ width: `${pct}%` }} />
        {expectedPct != null && (
          <span
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-text-3"
            style={{ left: `${expectedPct}%` }}
            title={`Expected ~${expected} by now`}
            aria-hidden
          />
        )}
      </div>
      {expected != null && (
        <div className="mt-1.5 text-[11px] text-text-3">
          Expected ~{expected} by now ({Math.round(pct)}% of target)
        </div>
      )}
    </div>
  );
}
