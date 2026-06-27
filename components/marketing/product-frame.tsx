import { cn } from "@/lib/utils";

/**
 * A clean browser frame for showing the real product on the landing (DESIGN.md
 * §9 — "shows the product", not a separate marketing illustration). Calm chrome:
 * three dots and an honest URL pill, then the app itself underneath.
 */
export function ProductFrame({
  url = "philasa.com/app",
  children,
  className,
}: {
  url?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-2 px-3.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="mx-auto inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1 text-[11px] text-text-3">
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {url}
        </span>
      </div>
      <div className="bg-bg">{children}</div>
    </div>
  );
}
