"use client";

import { Check } from "lucide-react";
import type { ConsentPurpose } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

/**
 * ConsentField (DESIGN.md §6 / Consent-Before-Capture Rule) — one purpose, a
 * plain-English description, and an explicit grant. Versioned (the version the
 * person agreed to travels with the record). Required purposes are needed to
 * book; optional ones default to the conservative (declined) state.
 */
export interface ConsentSpec {
  purpose: ConsentPurpose;
  title: string;
  description: string;
  required?: boolean;
}

export function ConsentField({
  spec,
  checked,
  onChange,
}: {
  spec: ConsentSpec;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-control border p-4 transition-colors",
        checked ? "border-accent/40 bg-accent-soft/40" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-accent" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        >
          {checked ? <Check className="size-3 text-accent" strokeWidth={3} aria-hidden /> : null}
        </span>
      </button>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-[600] text-text">{spec.title}</span>
          {spec.required ? (
            <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-3">
              needed to book
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-text-2">{spec.description}</span>
      </span>
    </label>
  );
}
