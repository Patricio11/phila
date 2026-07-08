import { WEEK_CAPACITY } from "@/lib/domain/helpers";
import { cn } from "@/lib/utils";

/**
 * The counsellor's own week-capacity bar (W6.2) — the same load model the Hub shows
 * for the whole team (`WEEK_CAPACITY` sessions/week), now surfaced to the counsellor
 * on their own dashboard so they can see at a glance whether they have room.
 */
export function WeekCapacity({ sessionsThisWeek }: { sessionsThisWeek: number }) {
  const pct = Math.min(100, Math.round((sessionsThisWeek / WEEK_CAPACITY) * 100));
  const stretched = pct >= 80;
  const full = pct >= 100;
  const label = full ? "At capacity" : stretched ? "Near capacity" : pct >= 50 ? "Filling up" : "Room to spare";

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-[640] text-text">Your week</span>
        <span className="text-[12px] tabular-nums text-text-3">
          <span className="font-semibold text-text">{sessionsThisWeek}</span> of {WEEK_CAPACITY} sessions
        </span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all", stretched ? "bg-warn" : "bg-accent")} style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <div className={cn("mt-1.5 text-[11.5px]", stretched ? "font-medium text-warn" : "text-text-3")}>{label}</div>
    </div>
  );
}
