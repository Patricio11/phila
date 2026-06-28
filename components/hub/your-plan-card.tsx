"use client";

import { Check, Sparkles } from "lucide-react";
import type { OrgSubscription } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function rands(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
function monthYear(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

const STATUS: Record<OrgSubscription["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-accent-soft text-accent" },
  trialing: { label: "Trial", cls: "bg-info-soft text-info" },
  past_due: { label: "Past due", cls: "bg-warn-soft text-warn" },
};

/**
 * The org's own Phila subscription — billed by Phila via the *system* gateway.
 * Deliberately separate from "Payments — your own gateway" (which is the org's
 * BYO gateway for client invoices). Two gateways, two purposes.
 */
export function YourPlanCard({ subscription }: { subscription: OrgSubscription }) {
  const { toast } = useToast();
  const { plan, status, nextBillingAt, billedVia } = subscription;
  const s = STATUS[status];

  const includes = [
    `${plan.seats} team seats`,
    `${plan.rooms} rooms`,
    plan.messaging ? "WhatsApp & SMS" : null,
    plan.videoMinutes ? `${plan.videoMinutes} video min / mo` : null,
    plan.aiTokens ? "AI assist" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-border bg-surface-2/40 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" strokeWidth={2} aria-hidden />
            <span className="text-[15px] font-[680] text-text">{plan.name}</span>
            <span className={`rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold ${s.cls}`}>{s.label}</span>
          </div>
          <div className="mt-1 text-[12.5px] text-text-2">{plan.tagline}</div>
        </div>
        <div className="text-right">
          <div className="text-[20px] font-bold tabular-nums text-text">{rands(plan.priceCents)}<span className="text-[12px] font-medium text-text-3"> /mo</span></div>
          <div className="mt-0.5 text-[11.5px] text-text-3">Renews {monthYear(nextBillingAt)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {includes.map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2">
            <Check className="size-3.5 text-accent" strokeWidth={2.5} aria-hidden /> {f}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-[12px] text-text-3">
          Billed by <span className="font-medium text-text-2">{billedVia}</span> — Phila&apos;s gateway, separate from your own client-payment gateway above.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => toast({ tone: "default", title: "Billing history", description: "Your Phila invoices and receipts will open here." })}>Billing history</Button>
          <Button variant="ghost" size="sm" onClick={() => toast({ tone: "default", title: "Change plan", description: "Compare plans and upgrade or downgrade — takes effect next cycle." })}>Change plan</Button>
        </div>
      </div>
    </div>
  );
}
