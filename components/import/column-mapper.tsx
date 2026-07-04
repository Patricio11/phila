"use client";

import { AlertTriangle, ArrowRight, Check, Copy, Table2 } from "lucide-react";
import type { ImportField } from "@/lib/import/schema";
import type { ParsedFile } from "@/lib/import/parse";
import type { BuildResult } from "@/lib/import/validate";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SKIP = "__skip";

/**
 * The mapping surface (Stripe / HubSpot style): one card per file column showing
 * its header + a sample, and a "Maps to → [field]" dropdown you can re-arrange.
 * Presentational — the host owns the mapping + the built result, so there are no
 * cross-component effects. Reusable for any import (pass a different field list).
 */
export function ColumnMapper({
  fields,
  parsed,
  mapping,
  result,
  onSetColumn,
}: {
  fields: ImportField[];
  parsed: ParsedFile;
  mapping: Record<string, number | null>;
  result: BuildResult;
  onSetColumn: (colIndex: number, fieldKey: string | null) => void;
}) {
  const fieldForColumn = (i: number): string | null => fields.find((f) => mapping[f.key] === i)?.key ?? null;
  const options = [{ value: SKIP, label: "Don't import" }, ...fields.map((f) => ({ value: f.key, label: f.label }))];
  const samples = (i: number) => parsed.rows.map((r) => (r[i] ?? "").trim()).filter(Boolean).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Required checklist */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-control border border-border bg-surface-2/40 px-3.5 py-2.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Required</span>
        {fields.filter((f) => f.required).map((f) => {
          const ok = mapping[f.key] != null;
          return (
            <span key={f.key} className={cn("inline-flex items-center gap-1 text-[12.5px] font-medium", ok ? "text-accent" : "text-text-3")}>
              <span className={cn("inline-flex size-4 items-center justify-center rounded-full", ok ? "bg-accent text-accent-ink" : "border border-border-strong")}>
                {ok ? <Check className="size-2.5" strokeWidth={3} aria-hidden /> : null}
              </span>
              {f.label}
            </span>
          );
        })}
        <span className="ml-auto text-[11.5px] text-text-3">Drag the dropdowns to re-map any column.</span>
      </div>

      {/* Column cards */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {parsed.headers.map((header, i) => {
          const current = fieldForColumn(i);
          const mapped = current != null;
          return (
            <div key={i} className={cn("rounded-card border p-3 transition-colors", mapped ? "border-accent/30 bg-accent-soft/15" : "border-border bg-surface")}>
              <div className="flex items-center gap-1.5 text-[13px] font-[620] text-text">
                <Table2 className="size-3.5 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                <span className="truncate">{header || `Column ${i + 1}`}</span>
              </div>
              <div className="mt-1 min-h-[16px] truncate text-[11.5px] text-text-3">{samples(i).join(" · ") || "no data"}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <ArrowRight className="size-3.5 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Select value={current ?? SKIP} onChange={(v) => onSetColumn(i, v === SKIP ? null : v)} options={options} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-text"><Check className="size-3.5 text-accent" strokeWidth={2.4} aria-hidden /> {result.ready.length} ready to import</span>
        {result.duplicates > 0 && <span className="inline-flex items-center gap-1.5 text-text-2"><Copy className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {result.duplicates} duplicate{result.duplicates === 1 ? "" : "s"} skipped</span>}
        {result.attention.length > 0 && <span className="inline-flex items-center gap-1.5 text-warn"><AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden /> {result.attention.length} need attention</span>}
      </div>

      {/* Live preview */}
      {result.ready.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border">
          <div className="border-b border-border bg-surface-2/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Preview · first {Math.min(6, result.ready.length)} of {result.ready.length}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border">
                  {fields.map((f) => <th key={f.key} className="whitespace-nowrap px-3 py-1.5 font-medium text-text-3">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.ready.slice(0, 6).map((row, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {fields.map((f) => {
                      const v = (row as unknown as Record<string, string | null>)[f.key];
                      return <td key={f.key} className={cn("whitespace-nowrap px-3 py-1.5", v ? "text-text" : "text-text-3")}>{v || "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attention detail */}
      {result.attention.length > 0 && (
        <p className="text-[11.5px] text-text-3">
          Skipped: {result.attention.slice(0, 3).map((a) => `row ${a.row} (${a.reason})`).join(", ")}
          {result.attention.length > 3 ? `, +${result.attention.length - 3} more` : ""}. Fix these in your file and re-upload if you need them.
        </p>
      )}
    </div>
  );
}
