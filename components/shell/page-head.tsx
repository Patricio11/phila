import { cn } from "@/lib/utils";

/**
 * Page head (DESIGN.md §5.3) — a greeting/title + one-line summary on the left,
 * primary actions on the right. Plain, warm, certain (§7).
 */
export function PageHead({
  title,
  summary,
  actions,
  className,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[21px] font-[680] tracking-[-0.025em] text-text">{title}</h2>
        {summary ? <p className="mt-1 text-[13.5px] text-text-2">{summary}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
