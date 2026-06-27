import { MessageSquareText } from "lucide-react";
import type { GrantBreakdowns, IndicatorActual, OutcomePoint } from "@/lib/data-provider";
import type { GrantNarrative } from "@/lib/mock/types";
import { Card, CardHead } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IndicatorMeter } from "@/components/funder/indicator-meter";
import { BreakdownBars } from "@/components/funder/breakdown-bars";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { coverageNote } from "@/lib/mock/helpers";

function postedOn(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * The shared grant dashboard  indicators vs target, k-anon demographic
 * breakdowns, the outcome trend, and the org's narrative updates. Rendered the
 * same way for the Hub and the funder portal; the funder version is read-only.
 */
export function GrantDashboard({
  indicators,
  breakdowns,
  outcome,
  narratives,
  narrativeSlot,
}: {
  indicators: IndicatorActual[];
  breakdowns: GrantBreakdowns;
  outcome: { points: OutcomePoint[]; coverage: { captured: number; total: number } };
  narratives: GrantNarrative[];
  /** The Hub passes a composer here; the funder portal leaves it read-only. */
  narrativeSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-3">Indicators vs target</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {indicators.map((item) => (
            <IndicatorMeter key={item.indicator.id} item={item} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-3">
          Breakdowns & outcomes <span className="font-normal normal-case text-text-3">· aggregate, k-anonymised</span>
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownBars title="By gender" rows={breakdowns.byGender} />
          <BreakdownBars title="By age band" rows={breakdowns.byAgeBand} />
          <BreakdownBars title="By province" rows={breakdowns.byProvince} />
          <Card>
            <CardHead title="Outcome trend (PHQ-9)" />
            <div className="px-[17px] pb-[17px]">
              <OutcomeSparkline
                points={outcome.points}
                tool="PHQ-9"
                coverage={coverageNote(outcome.coverage.captured, outcome.coverage.total, "measured")}
              />
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-3">Narrative updates</h2>
        {narrativeSlot ?? (narratives.length === 0 ? (
          <Card className="p-2">
            <EmptyState icon={MessageSquareText} title="No updates yet" body="Narrative updates from the organisation appear here." />
          </Card>
        ) : (
          <div className="space-y-3">
            {narratives.map((n) => (
              <Card key={n.id} className="p-4">
                <div className="flex items-center justify-between text-[12px] text-text-3">
                  <span className="font-medium text-text-2">{n.author}</span>
                  <span>{postedOn(n.postedAt)}</span>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">{n.body}</p>
              </Card>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
