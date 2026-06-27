import type { LucideIcon } from "lucide-react";
import { Lock, PowerOff, WalletMinimal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Blocked state (DESIGN.md §6) — names *why* something can't be shown (consent
 * missing / feature dormant / over the cost cap) and the next step, never a dead
 * end or a silent failure (Cost Rule, Dormant-by-Default Rule).
 */
type Reason = "consent" | "dormant" | "cap";

const ICON: Record<Reason, LucideIcon> = {
  consent: Lock,
  dormant: PowerOff,
  cap: WalletMinimal,
};

export function BlockedState({
  reason,
  title,
  body,
  action,
  className,
}: {
  reason: Reason;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = ICON[reason];
  return (
    <div className={cn("flex items-start gap-3 rounded-control border border-border bg-surface-2/60 p-4", className)}>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface text-text-3">
        <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-[600] text-text">{title}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{body}</p>
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  );
}
