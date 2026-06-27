"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Download, FileText, Loader2, Lock, Sparkles } from "lucide-react";
import type { Breakdown, ReportingFilters, ReportingResult } from "@/lib/data-provider";
import { AGE_BANDS, EMPLOYMENT_STATUSES, GENDERS, PROVINCES } from "@/lib/domain/enums";
import { AGE_BAND_LABELS, EMPLOYMENT_LABELS, GENDER_LABELS } from "@/lib/domain/labels";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FilterMenu } from "@/components/ui/filter-menu";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { useToast } from "@/components/ui/toast";
import { coverageNote } from "@/lib/mock/helpers";
import { exportFunderReport, runReport } from "@/app/hub/reporting/actions";

const PERIODS = ["This month", "This quarter", "Year to date", "Last 12 months"] as const;

function topLabels(rows: Breakdown[], n: number): { label: string; count: number }[] {
  return rows
    .filter((r) => !r.suppressed && (r.count ?? 0) > 0)
    .map((r) => ({ label: r.label, count: r.count ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function buildNarrative(result: ReportingResult, period: string, orgName: string): string {
  const provinces = topLabels(result.byProvince, 3);
  const provinceCount = result.byProvince.filter((r) => !r.suppressed && (r.count ?? 0) > 0).length;
  const genders = topLabels(result.byGender, 1);
  const pts = result.outcome.points;
  const first = pts[0]?.value ?? null;
  const last = pts[pts.length - 1]?.value ?? null;
  const delta = first !== null && last !== null ? last - first : null;

  const reach = provinces.length
    ? `Services reached clients across ${provinceCount} province${provinceCount === 1 ? "" : "s"}, with the largest cohorts in ${provinces.map((p) => p.label).join(", ")}.`
    : "Provincial cohorts this period were too small to report individually.";
  const genderLine = genders.length ? ` The largest group identified as ${GENDER_LABELS[genders[0]!.label as keyof typeof GENDER_LABELS] ?? genders[0]!.label}.` : "";
  const outcomeLine =
    delta === null
      ? " Outcome measurement is underway, with repeat PHQ-9 scores being captured as care continues."
      : delta < 0
        ? ` On the PHQ-9 depression measure, average scores improved by ${Math.abs(delta)} points across ${result.outcome.coverage.captured} clients with repeat measures (a lower score is better).`
        : delta > 0
          ? ` On the PHQ-9 measure, average scores rose by ${delta} points across ${result.outcome.coverage.captured} clients  a trend the team is monitoring.`
          : " PHQ-9 scores held steady across the measured cohort.";

  return (
    `During ${period.toLowerCase()}, ${orgName} provided counselling to ${result.matched} client${result.matched === 1 ? "" : "s"} who consented to demographic reporting ` +
    `(${coverageNote(result.withDemographics, result.totalClients, "of all clients")}). ${reach}${genderLine}${outcomeLine} ` +
    `All figures are aggregate and k-anonymised  cohorts too small to identify a person are suppressed.`
  );
}

function buildCsv(result: ReportingResult, period: string, orgName: string): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(q(`${orgName}  funder report`) + "," + q(period));
  lines.push(q("Clients matched") + "," + result.matched);
  lines.push(q("With demographic consent") + "," + q(`${result.withDemographics} of ${result.totalClients}`));
  lines.push("");
  const section = (title: string, rows: Breakdown[]) => {
    lines.push(q(title));
    rows.forEach((r) => lines.push(q(r.label) + "," + (r.suppressed ? q("suppressed (<k)") : String(r.count ?? 0))));
    lines.push("");
  };
  section("By province", result.byProvince);
  section("By gender", result.byGender);
  section("By population group", result.byPopulationGroup);
  section("By age band", result.byAgeBand);
  section("By employment", result.byEmployment);
  lines.push(q("PHQ-9 outcome trend (date, mean score)"));
  result.outcome.points.forEach((p) => lines.push(q(p.label) + "," + p.value));
  return lines.join("\n");
}

export function ReportingView({ initial, orgName }: { initial: ReportingResult; orgName: string }) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportingFilters>({});
  const [result, setResult] = useState(initial);
  const [period, setPeriod] = useState<string>("This quarter");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [exporting, startExport] = useTransition();

  const narrative = useMemo(() => buildNarrative(result, period, orgName), [result, period, orgName]);

  const update = (patch: ReportingFilters) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    startTransition(async () => setResult(await runReport(next)));
  };

  const copyNarrative = async () => {
    try {
      await navigator.clipboard.writeText(narrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ tone: "error", title: "Couldn't copy", description: "Select the text and copy manually." });
    }
  };

  const downloadCsv = () => {
    const csv = buildCsv(result, period, orgName);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funder-report-${period.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    startExport(async () => {
      await exportFunderReport("csv");
      toast({ tone: "success", title: "CSV exported", description: "k-anonymised  small cells suppressed, nothing identifiable." });
    });
  };

  const exportPdf = () =>
    startExport(async () => {
      await exportFunderReport("pdf");
      toast({ tone: "success", title: "Funder report ready (PDF)", description: "Aggregate, k-anonymised, audited. Use your browser's print-to-PDF on this page for a copy now." });
    });

  return (
    <div className="space-y-5">
      {/* Consent coverage */}
      <div className="flex items-start gap-2.5 rounded-control border border-accent/25 bg-accent-soft/40 p-3.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-text-2">
          Consent-gated: only clients who agreed to demographic reporting are counted {" "}
          <span className="font-semibold text-text">{coverageNote(result.withDemographics, result.totalClients, "clients")}</span>.
          Every figure applies a k-anonymity floor; cells below it read &ldquo;too few to report&rdquo;.
        </p>
      </div>

      {/* Filters + period */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44"><Select value={period} onChange={(v) => setPeriod(v ?? "This quarter")} options={PERIODS.map((p) => ({ value: p, label: p }))} /></div>
        <FilterMenu label="Province" value={filters.province} onChange={(v) => update({ province: v })} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
        <FilterMenu label="Gender" value={filters.gender} onChange={(v) => update({ gender: v })} options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))} />
        <FilterMenu label="Age band" value={filters.ageBand} onChange={(v) => update({ ageBand: v })} options={AGE_BANDS.map((a) => ({ value: a, label: AGE_BAND_LABELS[a] }))} />
        <FilterMenu label="Employment" value={filters.employment} onChange={(v) => update({ employment: v })} options={EMPLOYMENT_STATUSES.map((e) => ({ value: e, label: EMPLOYMENT_LABELS[e] }))} />
        {pending && <Loader2 className="size-4 animate-spin text-text-3" aria-hidden />}
        <span className="ml-auto text-[12.5px] text-text-3">{result.matched} {result.matched === 1 ? "client" : "clients"} match</span>
      </div>

      {/* Auto narrative */}
      <Card>
        <CardHead
          title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" strokeWidth={2} aria-hidden /> Funder narrative</span>}
          action={
            <Button variant="ghost" size="sm" onClick={copyNarrative}>
              {copied ? <Check className="size-4 text-accent" strokeWidth={2.4} aria-hidden /> : <Copy className="size-4" strokeWidth={2} aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          }
        />
        <div className="px-[17px] pb-[17px]">
          <p className="text-[13.5px] leading-relaxed text-text-2">{narrative}</p>
          <p className="mt-2 text-[11px] text-text-3">Generated from the figures below  edit freely before sending. Nothing identifiable is included.</p>
        </div>
      </Card>

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
            <OutcomeSparkline points={result.outcome.points} tool="PHQ-9" coverage={coverageNote(result.outcome.coverage.captured, result.outcome.coverage.total, "measured")} />
          </div>
        </Card>
      </div>

      {/* Export */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-[600] text-text">Export  {period}</div>
            <p className="text-[12px] text-text-2">Aggregate, k-anonymised, audited. The CSV downloads now; the narrative above is included with your figures.</p>
          </div>
          <Button variant="ghost" onClick={downloadCsv} loading={exporting}>
            <Download className="size-4" strokeWidth={2} aria-hidden /> Download CSV
          </Button>
          <Button onClick={exportPdf} loading={exporting}>
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
