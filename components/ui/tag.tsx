import { cn } from "@/lib/utils";

/**
 * Tag — small contextual label (DESIGN.md §6): neutral by default, with quiet
 * tones for online / room / intake / risk. Calm, never a rainbow.
 */
export type TagTone = "neutral" | "online" | "accent" | "warn" | "danger";

const TONE: Record<TagTone, string> = {
  neutral: "bg-surface-2 text-text-2 border-border",
  online: "bg-info-soft text-info border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: TagTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-[11.5px] font-medium leading-none",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
