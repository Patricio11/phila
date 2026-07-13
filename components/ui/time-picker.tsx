"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phila's own time picker (never the native minute-wheel — DESIGN §6). Two calm
 * columns — hour and minute — in 5-minute steps, with the working span leading
 * (early-morning hours sit at the end, so 08:00 is one glance away). Picking an
 * hour keeps the popover open; picking a minute completes the time and closes.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function TimePicker({
  value,
  onChange,
  minuteStep = 5,
  invalid,
  id,
  ariaLabel = "Time",
  placeholder = "Pick a time",
  compact,
  className,
}: {
  /** "HH:MM" or empty. */
  value: string;
  onChange: (value: string) => void;
  minuteStep?: number;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  /** Small inline variant for dense rows (e.g. the business-hours editor). */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<number | null>(value ? Number(value.slice(0, 2)) : null);
  const ref = useRef<HTMLDivElement>(null);
  const hourCol = useRef<HTMLDivElement>(null);
  const minCol = useRef<HTMLDivElement>(null);

  // Day-shaped hour order: 06:00–23:00 first (where sessions live), the small hours after.
  const hours = [...Array.from({ length: 18 }, (_, i) => i + 6), ...Array.from({ length: 6 }, (_, i) => i)];
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Bring the current selection into view when the popover opens.
  useEffect(() => {
    if (!open) return;
    hourCol.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "center" });
    minCol.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "center" });
  }, [open]);

  const openPicker = () => {
    setHour(value ? Number(value.slice(0, 2)) : null);
    setOpen((v) => !v);
  };

  const pickMinute = (m: number) => {
    const h = hour ?? (value ? Number(value.slice(0, 2)) : 9);
    onChange(`${pad(h)}:${pad(m)}`);
    setOpen(false);
  };

  const selMinute = value ? Number(value.slice(3, 5)) : null;
  const preview = hour !== null ? `${pad(hour)}:${selMinute !== null && Number(value.slice(0, 2)) === hour ? pad(selMinute) : "--"}` : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-control border bg-surface text-left tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          compact ? "h-8 px-2 text-[12.5px]" : "h-11 px-3 text-[14px]",
          invalid ? "border-danger" : "border-border",
          value ? "text-text" : "text-text-3",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <Clock className={cn("shrink-0 text-text-3", compact ? "size-3.5" : "size-4")} strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a time" className="pop absolute right-0 top-full z-40 mt-1.5 w-56 rounded-card border border-border bg-surface p-2.5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Pick a time</span>
            <span className="text-[13px] font-[660] tabular-nums text-text">{preview ?? value ?? ""}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Column label="Hour" colRef={hourCol}>
              {hours.map((h) => (
                <Cell key={h} selected={hour === h} onClick={() => setHour(h)}>{pad(h)}</Cell>
              ))}
            </Column>
            <Column label="Min" colRef={minCol}>
              {minutes.map((m) => (
                <Cell
                  key={m}
                  dim={hour === null}
                  selected={selMinute === m && value !== "" && Number(value.slice(0, 2)) === (hour ?? -1)}
                  onClick={() => pickMinute(m)}
                >
                  {pad(m)}
                </Cell>
              ))}
            </Column>
          </div>
          <p className="mt-2 border-t border-border px-1 pt-1.5 text-[10.5px] leading-snug text-text-3">Pick the hour, then the minutes.</p>
        </div>
      )}
    </div>
  );
}

function Column({ label, colRef, children }: { label: string; colRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  return (
    <div>
      <div className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-text-3">{label}</div>
      <div ref={colRef} className="flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded-[9px] bg-surface-2/50 p-1">
        {children}
      </div>
    </div>
  );
}

function Cell({ selected, dim, onClick, children }: { selected: boolean; dim?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-[7px] py-1.5 text-center text-[13px] tabular-nums transition-colors",
        selected ? "bg-accent font-semibold text-white shadow-sm" : "text-text-2 hover:bg-accent-soft hover:text-accent",
        dim && !selected && "text-text-3/60",
      )}
    >
      {children}
    </button>
  );
}
