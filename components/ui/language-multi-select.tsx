"use client";

import { Check } from "lucide-react";
import { LANGUAGES } from "@/lib/domain/languages";
import { cn } from "@/lib/utils";

/**
 * Phase 32.0 - the nice multi-select: languages as toggle chips, native names,
 * grouped by capability tier. Used for a counsellor's spoken languages (org
 * managed) and anywhere a set of languages is chosen.
 */
export function LanguageMultiSelect({ value, onChange, tiers = [1, 2, 3], disabled = false }: {
  value: string[];
  onChange: (codes: string[]) => void;
  /** Which tiers to offer (booking offers 1+2 prominently; staff can have any). */
  tiers?: number[];
  disabled?: boolean;
}) {
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  const groups = [
    { label: "Live translation ready", tier: 1 },
    { label: "Content in language", tier: 2 },
    { label: "Recorded only", tier: 3 },
  ].filter((g) => tiers.includes(g.tier));

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.tier}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">{g.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.filter((l) => l.tier === g.tier).map((l) => {
              const on = value.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(l.code)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50",
                    on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={2.6} aria-hidden />}
                  {l.nameNative}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
