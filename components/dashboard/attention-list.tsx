import { AlertTriangle, ChevronRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { AttentionItem } from "@/lib/data-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The needs-attention panel (DESIGN.md §6) — the triage list. Rose for
 * safeguarding, amber for missed/pending. Safeguarding items always point to a
 * human + current help and never name a method (Safeguarding Rule).
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing needs you right now"
        body="Safeguarding flags, missed sessions, and unsigned notes will surface here."
      />
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.tone === "rose" ? ShieldAlert : AlertTriangle;
        const body = (
          <div
            className={cn(
              "flex items-center gap-3 rounded-control border p-3 transition-colors",
              item.tone === "rose"
                ? "border-danger/20 bg-danger-soft/50 hover:bg-danger-soft"
                : "border-warn/20 bg-warn-soft/50 hover:bg-warn-soft",
            )}
          >
            <span
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-chip",
                item.tone === "rose" ? "bg-danger/12 text-danger" : "bg-warn/12 text-warn",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-text">{item.title}</div>
              <div className="mt-0.5 text-[12px] text-text-2">{item.detail}</div>
            </div>
            {item.href ? (
              <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
            ) : null}
          </div>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="block focus-visible:outline-none">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
