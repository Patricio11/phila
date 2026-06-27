"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A small custom filter dropdown (not a native select — DESIGN.md §6). Shows the
 * current value, opens a list, and supports an "Any" clear. Closes on select or
 * outside click.
 */
export function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: FilterOption[];
  onChange: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-[13px] transition-colors",
          value
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-border bg-surface text-text-2 hover:bg-surface-hover",
        )}
      >
        <span className="text-text-3">{label}:</span>
        <span className="font-medium">{current?.label ?? "Any"}</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-52 overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-[var(--shadow-card)]">
          <MenuItem selected={!value} onClick={() => { onChange(undefined); setOpen(false); }}>
            Any
          </MenuItem>
          {options.map((o) => (
            <MenuItem key={o.value} selected={o.value === value} onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
            </MenuItem>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-hover",
        selected ? "font-medium text-accent" : "text-text-2",
      )}
    >
      {children}
      {selected && <Check className="size-3.5 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />}
    </button>
  );
}
