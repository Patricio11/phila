import { cn } from "@/lib/utils";

/**
 * Skeleton (DESIGN.md §6) — matches the final dimensions of what's loading. The
 * shimmer is motion-safe (stripped under prefers-reduced-motion via the global
 * reduced-motion rule).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-surface-2 motion-safe:animate-pulse", className)} aria-hidden />;
}

/** A generic page skeleton: a head, a stat row, and two cards. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-card lg:col-span-2" />
        <Skeleton className="h-72 rounded-card" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** A table skeleton for list pages. */
export function TableSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full max-w-xs" />
      <div className="overflow-hidden rounded-card border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border p-3.5 last:border-0">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
