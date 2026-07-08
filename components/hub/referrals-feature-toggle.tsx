"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveOrgFeature } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

/**
 * Referral tracking (W7) — off by default. When on, staff can record how each client
 * found the practice (Add/Edit client) and a "Where clients come from" breakdown shows
 * in Insights. Some orgs don't want it, so it's a clean per-org switch (Dormant-by-Default).
 */
export function ReferralsFeatureToggle({ initial }: { initial: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await saveOrgFeature({ feature: "referrals", enabled: next });
      if (!res.ok) { setOn(!next); return toast({ tone: "error", title: res.error }); }
      toast({
        tone: "default",
        title: next ? "Referral tracking on" : "Referral tracking off",
        description: next ? "Record how clients find you  and see it in Insights." : "Hidden from client forms + Insights. Any captured sources are kept.",
      });
      router.refresh();
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
        <Share2 className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-[600] text-text">Referral tracking</span>
          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
          Capture how each client found you (WhatsApp, SADAG, a GP referral, word of mouth…) and see where your clients
          come from in Insights. Useful for funders and marketing  turn off if you&apos;d rather not ask.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        aria-label={`${on ? "Turn off" : "Turn on"} referral tracking`}
        onClick={toggle}
        className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60", on ? "bg-accent" : "bg-border-strong")}
      >
        <span className={cn("size-5 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
      </button>
    </div>
  );
}
