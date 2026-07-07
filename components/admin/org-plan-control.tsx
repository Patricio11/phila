"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import type { Plan } from "@/lib/domain/types";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setOrgPlan } from "@/app/admin/orgs/actions";

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

/** Move an org between plans (W3.4c) — entitlements + quotas follow immediately. */
export function OrgPlanControl({ orgId, planId, plans }: { orgId: string; planId: string; plans: Plan[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState(planId);
  const plan = plans.find((p) => p.id === selected) ?? plans[0]!;
  const changed = selected !== planId;

  const includes: string[] = [
    `${plan.seats ?? "Unlimited"} seats`,
    `${plan.storageGb} GB storage`,
    `${plan.rooms ?? "Unlimited"} rooms`,
    plan.aiTokens ? `${(plan.aiTokens / 1000).toLocaleString()}k AI tokens/mo` : "No AI",
    plan.videoMinutes ? `${plan.videoMinutes} video min/mo` : "No video",
    plan.messaging ? "WhatsApp & SMS" : "No messaging",
  ];

  const save = () => start(async () => {
    const res = await setOrgPlan({ orgId, planId: selected });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: `Moved to the ${plan.name} plan`, description: "Features & quotas updated immediately." });
    router.refresh();
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-[12px] font-medium text-text-2">Plan</label>
          <Select value={selected} onChange={setSelected} options={plans.map((p) => ({ value: p.id, label: `${p.name} — ${rands(p.priceCents)}/mo` }))} />
        </div>
        <Button onClick={save} loading={pending} disabled={!changed}>Change plan</Button>
      </div>

      <div className="rounded-control border border-border bg-surface-2/40 p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-accent" strokeWidth={2} aria-hidden />
          <span className="text-[13px] font-[640] text-text">{plan.name}</span>
          <span className="text-[12px] text-text-3">{plan.tagline}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {includes.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
              <Check className="size-3.5 text-accent" strokeWidth={2.5} aria-hidden /> {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
