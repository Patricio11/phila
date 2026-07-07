"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { FeatureResolution, OverrideState } from "@/db/queries/features";
import { FEATURE_REGISTRY } from "@/lib/domain/features";
import type { OrgFeature } from "@/lib/domain/enums";
import { useToast } from "@/components/ui/toast";
import { setOrgFeatureOverride } from "@/app/admin/orgs/actions";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<FeatureResolution["source"], string> = {
  platform: "Platform kill-switch",
  override: "Your override",
  plan: "Plan entitlement",
  self: "The practice's setting",
};

const OPTIONS: { value: OverrideState; label: string }[] = [
  { value: "inherit", label: "Inherit" },
  { value: "force_on", label: "Force on" },
  { value: "force_off", label: "Force off" },
];

export function OrgFeaturePanel({ orgId, resolutions }: { orgId: string; resolutions: FeatureResolution[] }) {
  return (
    <ul className="divide-y divide-border">
      {resolutions.map((r) => <FeatureRow key={r.feature} orgId={orgId} r={r} />)}
    </ul>
  );
}

function FeatureRow({ orgId, r }: { orgId: string; r: FeatureResolution }) {
  const { toast } = useToast();
  const router = useRouter();
  const [state, setState] = useState<OverrideState>(r.override);
  const [pending, start] = useTransition();
  const meta = FEATURE_REGISTRY[r.feature as OrgFeature];

  const change = (next: OverrideState) => {
    if (next === state) return;
    const prev = state;
    setState(next);
    start(async () => {
      const res = await setOrgFeatureOverride({ orgId, feature: r.feature, state: next });
      if (!res.ok) { setState(prev); return toast({ tone: "error", title: res.error }); }
      toast({ tone: "success", title: `${meta.label} · ${next.replace("_", " ")}`, description: "Effective state recalculated." });
      router.refresh();
    });
  };

  return (
    <li className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-text">{meta.label}</span>
          <span className={cn("inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", r.enabled ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
            {r.enabled ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : <X className="size-3" strokeWidth={2.5} aria-hidden />}
            {r.enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-text-3">{r.reason} <span className="text-text-3/70">· via {SOURCE_LABEL[r.source]}</span></p>
      </div>

      {/* Three-way override segmented control. */}
      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-control bg-surface-2 p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            onClick={() => change(o.value)}
            className={cn(
              "rounded-[7px] px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50",
              state === o.value
                ? o.value === "force_off" ? "bg-surface text-danger shadow-[var(--shadow-card)]" : o.value === "force_on" ? "bg-surface text-accent shadow-[var(--shadow-card)]" : "bg-surface text-text shadow-[var(--shadow-card)]"
                : "text-text-3 hover:text-text",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </li>
  );
}
