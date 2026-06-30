"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { startPlanCheckout } from "@/app/hub/billing/plan-actions";
import { cn } from "@/lib/utils";

function includes(p: Plan): string[] {
  return [
    p.seats === null ? "Unlimited seats" : `${p.seats} team seats`,
    p.rooms === null ? "Unlimited rooms" : `${p.rooms} rooms`,
    p.messaging ? "WhatsApp & SMS" : null,
    p.videoMinutes ? `${p.videoMinutes} video min / mo` : null,
    p.aiTokens ? "AI assist" : null,
  ].filter(Boolean) as string[];
}

export function PlanPicker({ plans, currentPlanId }: { plans: Plan[]; currentPlanId: string | null }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const choose = (id: string) => start(async () => {
    const res = await startPlanCheckout({ planId: id });
    if (!res.ok) return toast({ tone: "default", title: "Change plan", description: res.error });
    window.location.href = res.url; // → Paystack checkout (paid to Phila)
  });

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => {
        const current = p.id === currentPlanId;
        return (
          <div key={p.id} className={cn("relative flex flex-col rounded-card border p-4", current ? "border-accent/50 bg-accent-soft/20" : p.popular ? "border-accent/30 bg-surface" : "border-border bg-surface")}>
            {p.popular && !current && <span className="absolute right-3 top-3 rounded-full bg-accent px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white">Popular</span>}
            {current && <span className="absolute right-3 top-3 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">Current</span>}
            <div className="text-[15px] font-[680] text-text">{p.name}</div>
            <div className="mt-0.5 min-h-[32px] text-[11.5px] text-text-3">{p.tagline}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[24px] font-[740] tabular-nums text-text">R{(p.priceCents / 100).toLocaleString()}</span>
              <span className="text-[11px] text-text-3">/ mo</span>
            </div>
            <ul className="mt-3 flex-1 space-y-1.5">
              {includes(p).map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-[12px] text-text-2"><Check className="size-3.5 shrink-0 text-accent" strokeWidth={2.4} aria-hidden /> {f}</li>
              ))}
            </ul>
            <div className="mt-4">
              {current ? (
                <Button variant="ghost" size="sm" className="w-full" disabled>Current plan</Button>
              ) : (
                <Button size="sm" className="w-full" loading={pending} onClick={() => choose(p.id)}>Switch to {p.name}</Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
