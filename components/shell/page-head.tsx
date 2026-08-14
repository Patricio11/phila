"use client";

import { useEffect } from "react";
import { usePageHeadSetter } from "@/components/shell/page-head-context";
import { cn } from "@/lib/utils";

/**
 * Page head (DESIGN.md §5.3, reworked in batch 3o). Inside the app shell the
 * title + summary render in the TOP BAR (where the date line used to be) so
 * the page never repeats its own name; only the action buttons stay in the
 * body. Outside the shell (no provider) it renders in place as before.
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
  const set = usePageHeadSetter();

  useEffect(() => {
    if (!set) return;
    set({ title, summary });
    return () => set(null);
  }, [set, title, summary]);

  if (set) {
    return actions ? (
      <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>{actions}</div>
    ) : null;
  }

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
