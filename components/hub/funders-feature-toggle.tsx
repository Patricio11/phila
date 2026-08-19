"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveOrgFeature } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * Enable the Funders & grants (M&E) module. Off by default  most practices don't
 * report to funders, so the whole area (nav + pages) stays hidden until an org opts
 * in here. Persisted to the org's features flag; the hub nav re-renders on save.
 */
export function FundersFeatureToggle({ initial }: { initial: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await saveOrgFeature({ feature: "funders", enabled: next });
      if (!res.ok) {
        setOn(!next);
        return toast({ tone: "error", title: res.error });
      }
      toast({
        tone: "default",
        title: next ? "Funders & grants on" : "Funders & grants off",
        description: next ? "Added to your sidebar  set up funders, grants and targets." : "Hidden from your workspace. Your grant data is kept.",
      });
      router.refresh();
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
        <HandCoins className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-[600] text-text">Funders &amp; grants (M&amp;E)</span>
          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
          Track grants against funder targets  indicators roll up live from the clinical work, with k-anonymised
          reporting and a read-only funder portal. Turn on if your practice reports to funders or donors.
        </p>
      </div>
      <Switch checked={on} onChange={toggle} disabled={pending} label={`${on ? "Turn off" : "Turn on"} Funders and grants`} className="mt-0.5" />
    </div>
  );
}
