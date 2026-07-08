import type { OutcomeMeasure } from "@/lib/domain/types";
import { OUTCOME_TOOLS, type OutcomeTool } from "@/lib/domain/enums";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";

/** Short scale names so the reader knows what each trend measures. */
const TOOL_NOTE: Record<string, string> = {
  "PHQ-9": "Depression (PHQ-9) · 0–27, lower is better",
  "GAD-7": "Anxiety (GAD-7) · 0–21, lower is better",
};

function label(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

/**
 * Per-tool outcome trends (W7) — a separate sparkline for each measure a client has
 * (PHQ-9, GAD-7…), so different scales are never mixed onto one line. Completes the
 * outcomes story: both tools were captured; now both are shown.
 */
export function OutcomeTrends({ outcomes }: { outcomes: OutcomeMeasure[] }) {
  const byTool = new Map<OutcomeTool, OutcomeMeasure[]>();
  for (const o of outcomes) (byTool.get(o.tool) ?? byTool.set(o.tool, []).get(o.tool)!).push(o);

  // Stable order (PHQ-9 then GAD-7); only tools with a real trend (≥ 2 measures).
  const trends = OUTCOME_TOOLS
    .map((tool) => ({ tool, list: (byTool.get(tool) ?? []).slice().sort((a, b) => a.takenAt.localeCompare(b.takenAt)) }))
    .filter((t) => t.list.length >= 2);

  if (trends.length === 0) {
    return <p className="px-1 py-6 text-center text-[12.5px] text-text-3">Not yet measured — trends appear once two or more scores are captured.</p>;
  }

  return (
    <div className="space-y-5">
      {trends.map(({ tool, list }) => (
        <div key={tool}>
          <div className="mb-1 text-[11.5px] font-medium text-text-3">{TOOL_NOTE[tool] ?? tool}</div>
          <OutcomeSparkline points={list.map((o) => ({ label: label(o.takenAt), value: o.score }))} tool={tool} coverage={`${list.length} measures captured`} />
        </div>
      ))}
    </div>
  );
}
