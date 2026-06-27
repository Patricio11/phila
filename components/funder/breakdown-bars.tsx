import type { Breakdown } from "@/lib/data-provider";
import { Card, CardHead } from "@/components/ui/card";

/**
 * A k-anon demographic breakdown. Cells below the floor read "too few to report"
 * — never an identifiable count (Outcome-Honesty Rule). Used by the grant
 * dashboard and the funder portal alike.
 */
export function BreakdownBars({ title, rows }: { title: string; rows: Breakdown[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count ?? 0));
  return (
    <Card>
      <CardHead title={title} />
      <div className="space-y-2.5 px-[17px] pb-[17px]">
        {rows.length === 0 ? (
          <p className="text-[12.5px] text-text-3">No consented data in this grant.</p>
        ) : (
          rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-text-2">{r.label}</span>
                {r.suppressed ? (
                  <span className="text-[11.5px] italic text-text-3">too few to report</span>
                ) : (
                  <span className="font-semibold tabular-nums text-text">{r.count}</span>
                )}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={r.suppressed ? "h-full rounded-full bg-border-strong" : "h-full rounded-full bg-accent"}
                  style={{ width: r.suppressed ? "12%" : `${((r.count ?? 0) / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
