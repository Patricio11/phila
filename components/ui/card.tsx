import { cn } from "@/lib/utils";

/**
 * Card / CardHead  DESIGN.md §6. A raised surface with a hairline border that
 * lifts a shadow step on hover. The head carries a title (+ optional muted count
 * pill) on the left and a single action on the right.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-sm",
        interactive &&
          "transition-shadow duration-150 hover:shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHead({
  title,
  count,
  action,
  className,
}: {
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-[17px] py-[14px]",
        className,
      )}
    >
      <h2 className="flex items-center gap-2 text-[14.5px] font-[650] tracking-[-0.01em] text-text">
        {title}
        {count !== undefined && (
          <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-text-3">
            {count}
          </span>
        )}
      </h2>
      {action ? <div className="flex items-center gap-1.5">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-[17px] pb-[17px]", className)} {...props} />;
}

export function CardDivider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border", className)} />;
}
