import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState (DESIGN.md §6) — an invitation to act, never a dead end. A quiet
 * icon, a plain title, one line of guidance, and an optional action.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2 text-text-3">
        <Icon className="size-5" strokeWidth={1.9} aria-hidden />
      </span>
      <h3 className="mt-3.5 text-[14px] font-[600] text-text">{title}</h3>
      {body ? <p className="mt-1 max-w-xs text-[12.5px] text-text-2">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
