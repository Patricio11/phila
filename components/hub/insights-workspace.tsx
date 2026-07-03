"use client";

import { useState } from "react";
import { LineChart, PieChart } from "lucide-react";
import type { HubInsights, ReportingResult } from "@/lib/data-provider";
import { HubInsightsView } from "@/components/hub/hub-insights-view";
import { ReportingView } from "@/components/hub/reporting-view";
import { cn } from "@/lib/utils";

type TabKey = "practice" | "funder";
const TABS: { key: TabKey; label: string; icon: typeof LineChart }[] = [
  { key: "practice", label: "Practice", icon: LineChart },
  { key: "funder", label: "Funder reporting", icon: PieChart },
];

/**
 * One analytics home. "Practice" is the honest operational view (real counts,
 * period deltas, session mix); "Funder reporting" is the consent-gated, k-anonymised
 * view (breakdowns, outcomes, narrative, export). Reporting used to be its own nav
 * item — it now lives here as a tab. Both panels stay mounted (each keeps its own
 * filters), hidden when inactive.
 */
export function InsightsWorkspace({ insights, reporting, orgName }: { insights: HubInsights; reporting: ReportingResult; orgName: string }) {
  const [tab, setTab] = useState<TabKey>("practice");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Analytics views" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex gap-1 rounded-card border border-border bg-surface p-1">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-control px-3.5 py-2 text-[13px] font-medium transition-colors",
                  on ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover hover:text-text",
                )}
              >
                <t.icon className="size-4" strokeWidth={2} aria-hidden /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" hidden={tab !== "practice"}>
        <HubInsightsView initial={insights} />
      </div>
      <div role="tabpanel" hidden={tab !== "funder"}>
        <ReportingView initial={reporting} orgName={orgName} />
      </div>
    </div>
  );
}
