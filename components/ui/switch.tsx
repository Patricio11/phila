"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one switch. Every on/off control in Phila renders through here so they all
 * look and behave the same: 44 x 24 track, a 20 px knob that travels exactly the
 * inner width (the track wears its own transparent border and `p-0`, so a
 * browser's default button padding can never shove the knob past the edge - the
 * bug the hand-rolled versions had), accent when on, a danger tone for
 * kill-switches, an honest disabled state, and a visible focus ring.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  tone = "accent",
  showCheck = false,
  className,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name - what a screen reader announces. */
  label: string;
  disabled?: boolean;
  tone?: "accent" | "danger";
  /** A small tick inside the knob when on (used where the switch stands alone). */
  showCheck?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative box-border inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent p-0 leading-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? (tone === "danger" ? "bg-danger" : "bg-accent") : "bg-border-strong",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      >
        {showCheck && checked ? <Check className={cn("size-3", tone === "danger" ? "text-danger" : "text-accent")} strokeWidth={3} aria-hidden /> : null}
      </span>
    </button>
  );
}
