"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/use-theme";
import { cn } from "@/lib/utils";

/**
 * Light ↔ dark toggle for the top bar (DESIGN.md §5.2). The icon cross-fades;
 * the label is read by screen readers. No "system" option by design (§10).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <Sun
        className="size-[18px] scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90"
        aria-hidden
      />
      <Moon
        className="absolute size-[18px] scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0"
        aria-hidden
      />
    </button>
  );
}
