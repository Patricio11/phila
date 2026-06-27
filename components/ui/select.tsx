"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A custom select (portaled-less dropdown, never a native <select> — DESIGN §6).
 * Closes on select or outside click; keyboard-focusable trigger.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  invalid,
  id,
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
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
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          invalid ? "border-danger" : "border-border",
          current ? "text-text" : "text-text-3",
        )}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-text-3" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-[var(--shadow-card)]"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-[6px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-surface-hover",
                o.value === value ? "font-medium text-accent" : "text-text-2",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                {o.hint ? <span className="block truncate text-[11.5px] text-text-3">{o.hint}</span> : null}
              </span>
              {o.value === value && <Check className="size-4 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
