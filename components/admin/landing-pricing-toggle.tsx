"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { setLandingPricing } from "@/app/admin/plans/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export function LandingPricingToggle({ initial }: { initial: boolean }) {
  const { toast } = useToast();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = !on;
      setOn(next); // optimistic
      const res = await setLandingPricing(next);
      if (!res.ok) {
        setOn(!next);
        return toast({ tone: "error", title: res.error });
      }
      toast({ tone: "success", title: next ? "Pricing is now live on the landing page" : "Pricing hidden from the landing page" });
    });

  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 inline-flex size-8 items-center justify-center rounded-lg", on ? "bg-accent text-white" : "bg-surface-2 text-text-3")}>
          {on ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
        </span>
        <div>
          <div className="text-[13.5px] font-[640] text-text">Show pricing on the landing page</div>
          <p className="mt-0.5 text-[12px] text-text-2">
            {on ? "Visitors see these plans at the public landing page (#pricing)." : "Hidden while you finalise pricing  the public page shows no plans."}
          </p>
        </div>
      </div>
      <Switch checked={on} onChange={toggle} label="Show pricing on the landing page" disabled={pending} />
    </div>
  );
}
