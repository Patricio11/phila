"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A searchable single-select (combobox)  the reusable version of the inline
 * "search team" pattern used in messaging. Type to filter; an optional `footer`
 * render-prop can add an action (e.g. "New client") and close the popover.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  invalid,
  disabled,
  emptyText = "No matches",
  footer,
  ariaLabel,
}: {
  value: string | null;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  emptyText?: string;
  footer?: (close: () => void) => React.ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const needle = q.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-[13.5px] transition-colors disabled:opacity-60",
          invalid ? "border-danger" : "border-border hover:bg-surface-hover",
          open && "ring-2 ring-accent/50",
        )}
      >
        <span className={cn("truncate", selected ? "text-text" : "text-text-3")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-text-3 transition-transform", open && "rotate-180")} strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-control border border-border bg-surface pl-8 pr-2 text-[12.5px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-[12.5px] text-text-3">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                    className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-hover", o.value === value && "bg-accent-soft/40")}
                  >
                    <span className="truncate text-text">{o.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {o.hint && <span className="text-[11.5px] text-text-3">{o.hint}</span>}
                      {o.value === value && <Check className="size-3.5 text-accent" strokeWidth={2.4} aria-hidden />}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {footer && <div className="border-t border-border">{footer(() => setOpen(false))}</div>}
        </div>
      )}
    </div>
  );
}
