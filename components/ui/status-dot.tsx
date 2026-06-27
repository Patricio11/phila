import { cn } from "@/lib/utils";

/**
 * Status is a small dot + a label, never colour alone (DESIGN.md §4 / WCAG).
 * green = completed · blue = in session · amber = attention · grey = upcoming ·
 * rose = safeguarding/risk.
 */
export type DotTone = "green" | "blue" | "amber" | "grey" | "rose";

const TONE: Record<DotTone, string> = {
  green: "bg-accent",
  blue: "bg-info",
  amber: "bg-warn",
  grey: "bg-text-3",
  rose: "bg-danger",
};

export function StatusDot({
  tone,
  className,
  pulse = false,
}: {
  tone: DotTone;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        TONE[tone],
        pulse && "motion-safe:animate-pulse",
        className,
      )}
    />
  );
}
