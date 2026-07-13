"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phila's own calendar picker (never the native control — DESIGN §6). A calm
 * month grid in the product's language: Monday-first (matches the business-hours
 * model), today ringed, the chosen day filled accent, closed/past days quietly
 * disabled. Opens as a `.pop` popover; closes on pick, Esc, or outside click.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Local today as yyyy-mm-dd (the picker is a wall-clock control). */
function todayIso(): string {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}

function prettyLabel(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** The 42-cell (6-week) grid for a month, Monday-first; null = out-of-month pad. */
function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday-first offset
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePicker({
  value,
  onChange,
  min,
  isDayDisabled,
  invalid,
  id,
  ariaLabel = "Date",
  placeholder = "Pick a date",
}: {
  /** yyyy-mm-dd or empty. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day (yyyy-mm-dd). */
  min?: string;
  /** Extra per-day rule, e.g. the practice's closed days. */
  isDayDisabled?: (isoDate: string) => boolean;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = todayIso();
  const anchor = value || today;
  const [view, setView] = useState({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) - 1 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openPicker = () => {
    const a = value || today;
    setView({ year: Number(a.slice(0, 4)), month: Number(a.slice(5, 7)) - 1 });
    setOpen((v) => !v);
  };

  const step = (delta: number) => {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const disabled = (d: string) => (min ? d < min : false) || (isDayDisabled?.(d) ?? false);
  const cells = monthGrid(view.year, view.month);
  // Don't page back past the month that holds `min` — everything earlier is dead.
  const atMinMonth = min ? `${view.year}-${pad(view.month + 1)}` <= min.slice(0, 7) : false;

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          invalid ? "border-danger" : "border-border",
          value ? "text-text" : "text-text-3",
        )}
      >
        <span className="truncate">{value ? prettyLabel(value) : placeholder}</span>
        <CalendarDays className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date" className="pop absolute left-0 top-full z-40 mt-1.5 w-[19rem] rounded-card border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
          {/* Month header */}
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[13.5px] font-[660] text-text">{MONTHS[view.month]} {view.year}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} disabled={atMinMonth} aria-label="Previous month" className="grid size-7 place-items-center rounded-[7px] text-text-3 transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40">
                <ChevronLeft className="size-4" strokeWidth={2.2} aria-hidden />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next month" className="grid size-7 place-items-center rounded-[7px] text-text-3 transition-colors hover:bg-surface-2 hover:text-text">
                <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 pb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className={cn("py-1 text-center text-[10.5px] font-semibold uppercase tracking-wide", w === "Sa" || w === "Su" ? "text-text-3/70" : "text-text-3")}>{w}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const dIso = iso(view.year, view.month, d);
              const isSel = dIso === value;
              const isToday = dIso === today;
              const off = disabled(dIso);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={off}
                  aria-label={prettyLabel(dIso)}
                  aria-pressed={isSel}
                  onClick={() => { onChange(dIso); setOpen(false); }}
                  className={cn(
                    "mx-auto grid size-9 place-items-center rounded-[9px] text-[13px] tabular-nums transition-colors",
                    isSel
                      ? "bg-accent font-semibold text-white shadow-sm"
                      : off
                        ? "text-text-3/50 line-through decoration-border-strong"
                        : "text-text-2 hover:bg-accent-soft hover:text-accent",
                    isToday && !isSel && "font-semibold text-accent ring-1 ring-inset ring-accent/40",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Footer: one-tap today */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="px-1 text-[11px] text-text-3">{value ? prettyLabel(value) : "Nothing picked yet"}</span>
            <button
              type="button"
              disabled={disabled(today)}
              onClick={() => { onChange(today); setOpen(false); }}
              className="rounded-chip px-2 py-1 text-[12px] font-medium text-accent transition-colors hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-40"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
