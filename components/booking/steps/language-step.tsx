"use client";

import { useState } from "react";
import { Check, Globe } from "lucide-react";
import { LANGUAGES } from "@/lib/domain/languages";
import { StepHeader } from "@/components/booking/step-header";
import { cn } from "@/lib/utils";

/**
 * Phase 32.0 - the language step (plan 7.1). Native names, English first,
 * Tier 1 and 2 up front, "Another language" opens Tier 3. Choosing here is the
 * moment the need becomes data.
 */
export function LanguageStep({ language, onLanguage }: {
  language: string | null;
  onLanguage: (code: string) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const main = LANGUAGES.filter((l) => l.tier <= 2);
  const more = LANGUAGES.filter((l) => l.tier === 3);

  const Item = ({ code, label }: { code: string; label: string }) => {
    const selected = language === code;
    return (
      <button
        type="button"
        onClick={() => onLanguage(code)}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-3 rounded-control border p-3 text-left transition-colors",
          selected ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
        )}
      >
        <span className="min-w-0 flex-1 text-[14px] font-[600] text-text">{label}</span>
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full border",
            selected ? "border-accent bg-accent text-accent-ink" : "border-border-strong",
          )}
          aria-hidden
        >
          {selected ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      </button>
    );
  };

  return (
    <div>
      <StepHeader
        title="What language would you like your session in?"
        subtitle="We will match you with a counsellor who speaks your language where we can. Where we cannot, we can translate."
      />
      <div className="space-y-2">
        {main.map((l) => <Item key={l.code} code={l.code} label={l.nameNative} />)}
      </div>
      {!showMore ? (
        <button type="button" onClick={() => setShowMore(true)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
          <Globe className="size-4" strokeWidth={2} aria-hidden /> Another language
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          {more.map((l) => <Item key={l.code} code={l.code} label={`${l.nameNative} (${l.nameEn})`} />)}
        </div>
      )}
    </div>
  );
}
