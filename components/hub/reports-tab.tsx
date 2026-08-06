"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Loader2, Search } from "lucide-react";
import type { OperationalReport, ReportType } from "@/db/queries/reports";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/hub/export-menu";
import { getOperationalReport, auditReportExport } from "@/app/hub/insights/actions";
import { cn } from "@/lib/utils";

const TYPES: { value: ReportType; label: string }[] = [
  { value: "bookings", label: "Bookings summary" },
  { value: "cancelled", label: "Cancelled bookings" },
  { value: "no_shows", label: "No-shows" },
  { value: "by_counsellor", label: "Bookings by counsellor" },
  { value: "by_service", label: "Bookings by service" },
  { value: "payments_paid", label: "Fully paid invoices" },
  { value: "payments_pending", label: "Payment pending / unpaid" },
];

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" },
];

/**
 * Operational reports (batch 2c) — pick a report + period, the table loads
 * live, search within it, export as CSV / Excel / PDF (every export audited).
 */
export function ReportsTab({ orgName }: { orgName: string }) {
  const [type, setType] = useState<ReportType>("bookings");
  const [period, setPeriod] = useState("month");
  const [report, setReport] = useState<OperationalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    getOperationalReport({ type, period })
      .then((res) => { if (live && res.ok) setReport(res.report); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [type, period]);

  const rows = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    if (!q) return report.rows;
    return report.rows.filter((r) => r.some((c) => c.toLowerCase().includes(q)));
  }, [report, query]);

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "This month";
  const typeLabel = TYPES.find((t) => t.value === type)?.label ?? "Report";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1.5 sm:w-64">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Report type</div>
            <Select value={type} onChange={(v) => setType(v as ReportType)} options={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          </div>
          <div className="w-full space-y-1.5 sm:w-44">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Period</div>
            <Select value={period} onChange={setPeriod} options={PERIODS} />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Search</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter the results…" className="pl-8" aria-label="Search report rows" />
            </div>
          </div>
          {report && (
            <ExportMenu
              table={{
                filenameBase: `report-${type}-${today}`,
                title: typeLabel,
                subtitle: `${orgName} · ${periodLabel} · ${rows.length} row${rows.length === 1 ? "" : "s"}`,
                headers: report.headers,
                rows,
              }}
              onExported={async (format) => { await auditReportExport({ type, format, count: rows.length }); }}
            />
          )}
        </div>
      </Card>

      {/* Results */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <FileBarChart className="size-4 text-text-3" strokeWidth={2} aria-hidden />
          <span className="text-[13.5px] font-[620] text-text">{typeLabel}</span>
          <span className="text-[12.5px] text-text-3">· {periodLabel}</span>
          {report && (
            <span className="ml-auto text-[12.5px] text-text-2">
              {query ? `${rows.length} of ${report.rows.length} rows · ` : ""}{report.summary}
            </span>
          )}
        </div>

        {loading && !report ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-text-3">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Building the report…
          </div>
        ) : !report || rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-text-3">
            {query ? "No rows match your search." : "Nothing in this period — try a wider one."}
          </p>
        ) : (
          <div className={cn("overflow-x-auto", loading && "opacity-60")}>
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] uppercase tracking-wide text-text-3">
                  {report.headers.map((h) => <th key={h} className="px-3.5 py-2.5 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
                    {r.map((c, j) => (
                      <td key={j} className={cn("px-3.5 py-2.5", j === 0 ? "font-medium text-text" : "text-text-2", /^R[\d\s,]+$/.test(c) && "tabular-nums")}>
                        {c === "No-show" || c === "Yes" ? <span className="rounded-chip bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn">{c}</span>
                          : c === "Completed" ? <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">{c}</span>
                          : c === "Cancelled" ? <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-3">{c}</span>
                          : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
