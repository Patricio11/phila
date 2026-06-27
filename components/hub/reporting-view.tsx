"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Loader2, Lock } from "lucide-react";
import type { Breakdown, ReportingFilters, ReportingResult } from "@/lib/data-provider";
import {
  AGE_BANDS,
  EMPLOYMENT_STATUSES,
  GENDERS,
  PROVINCES,
} from "@/lib/domain/enums";
import { AGE_BAND_LABELS, EMPLOYMENT_LABELS, GENDER_LABELS } from "@/lib/domain/labels";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { useToast } from "@/components/ui/toast";
import { coverageNote } from "@/lib/mock/helpers";
import { exportFunderReport, runReport } from "@/app/hub/reporting/actions";

export function ReportingView({ initial }: { initial: ReportingResult }) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportingFilters>({});
  const [result, setResult] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [exporting, startExport] = useTransition();

  const update = (patch: ReportingFilters) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    startTransition(async () => setResult(await runReport(next)));
  };

  const onExport = (format: "pdf" | "csv") =>
    startExport(async () => {
      await exportFunderReport(format);
      toast({ tone: "success", title: `Funder report exported (${format.toUpperCase()})`, description: "k-anonymised — small cells suppressed, nothing identifiable." });
    });

  return (
    <div className="space-y-5">
      {/* Consent coverage — honest, always shown */}
      <div className="flex items-start gap-2.5 rounded-control border border-accent/25 bg-accent-soft/40 p-3.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-text-2">
          Consent-gated: only clients who agreed to demographic reporting are counted —{" "}
          <span className="font-semibold text-text">{coverageNote(result.withDemographics, result.totalClients, "clients")}</span>.
          Every figure applies a k-anonymity floor; cells below it read &ldquo;too few to report&rdquo;.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu label="Province" value={filters.province} onChange={(v) => update({ province: v })} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
        <FilterMenu label="Gender" value={filters.gender} onChange={(v) => update({ gender: v })} options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))} />
        <FilterMenu label="Age band" value={filters.ageBand} onChange={(v) => update({ ageBand: v })} options={AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABELS[a] }))} />
        <FilterMenu label="Employment" value={filters.employment} onChange={(v) => update({ employment: v })} options={EMPLOYMENT_STATUSES.map((e) => ({ value: e, label: EMPLOYMENT_LABELS[e] }))} />
        {pending && <Loader2 className="size-4 animate-spin text-text-3" aria-hidden />}
        <span className="ml-auto text-[12.5px] text-text-3">
          {result.matched} {result.matched === 1 ? "client" : "clients"} match
        </span>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="By province" rows={result.byProvince} />
        <BreakdownCard title="By gender" rows={result.byGender} />
        <BreakdownCard title="By population group" rows={result.byPopulationGroup} />
        <BreakdownCard title="By age band" rows={result.byAgeBand} />
        <BreakdownCard title="By employment" rows={result.byEmployment} />

        <Card>
          <CardHead title="Outcome trend (PHQ-9)" />
          <div className="px-[17px] pb-[17px]">
            <OutcomeSparkline
              points={result.outcome.points}
              tool="PHQ-9"
              coverage={coverageNote(result.outcome.coverage.captured, result.outcome.coverage.total, "measured")}
            />
          </div>
        </Card>
      </div>

      {/* Export */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-[600] text-text">One-click funder report</div>
            <p className="text-[12px] text-text-2">Aggregate, k-anonymised, audited — ready for a funder. Never an identifiable client.</p>
          </div>
          <Button variant="ghost" onClick={() => onExport("csv")} loading={exporting}>
            <Download className="size-4" strokeWidth={2} aria-hidden /> CSV
          </Button>
          <Button onClick={() => onExport("pdf")} loading={exporting}>
            <FileText className="size-4" strokeWidth={2} aria-hidden /> Funder report (PDF)
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Breakdown[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count ?? 0));
  return (
    <Card>
      <CardHead title={title} />
      <div className="space-y-2.5 px-[17px] pb-[17px]">
        {rows.length === 0 ? (
          <p className="text-[12.5px] text-text-3">No data in this view.</p>
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
