"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phila's own checkbox (never the OS control — DESIGN §6). A real (hidden)
 * <input type="checkbox"> keeps label association, keyboard toggling, and a11y;
 * the visible box is fully ours: accent fill + white check, soft focus ring.
 * `fillClassName` lets branded surfaces (the public booking page) fill with the
 * org's --brand instead of the app accent.
 */
export function Checkbox({
  checked,
  onChange,
  id,
  ariaLabel,
  size = "md",
  fillClassName = "border-accent bg-accent",
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
  /** Border+background classes applied when checked (override for branded pages). */
  fillClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <input
        type="checkbox"
        id={id}
        aria-label={ariaLabel}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none grid place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-surface",
          size === "sm" ? "size-4" : "size-[18px]",
          checked ? fillClassName : "border-border-strong bg-surface",
        )}
      >
        <Check
          className={cn("text-white transition-opacity", size === "sm" ? "size-3" : "size-3.5", checked ? "opacity-100" : "opacity-0")}
          strokeWidth={3}
          aria-hidden
        />
      </span>
    </span>
  );
}
