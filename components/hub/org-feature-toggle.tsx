"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, ListChecks, type LucideIcon } from "lucide-react";
import type { OrgFeature } from "@/lib/domain/enums";
import { useToast } from "@/components/ui/toast";
import { saveOrgFeature } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<OrgFeature, LucideIcon>> = { waitlist: ListChecks, outcomes: Activity };

/**
 * A generic per-org feature switch for the Settings page (batch 2h) - same
 * shape as the Funders/Referrals/Language toggles, driven by props so new
 * features don't each need their own component. `locked` = a Phila
 * kill-switch / override / plan decides above the org; the reason is shown.
 */
export function OrgFeatureToggle({ feature, label, description, onDescription, offDescription, initial, locked, lockedReason }: {
  feature: OrgFeature;
  label: string;
  description: string;
  onDescription: string;
  offDescription: string;
  initial: boolean;
  locked?: boolean;
  lockedReason?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const Icon = ICONS[feature] ?? Activity;

  const toggle = () => {
    if (locked) return toast({ tone: "error", title: lockedReason ?? "This switch is managed by Phila." });
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await saveOrgFeature({ feature, enabled: next });
      if (!res.ok) { setOn(!next); return toast({ tone: "error", title: res.error }); }
      toast({ tone: "default", title: next ? `${label} on` : `${label} off`, description: next ? onDescription : offDescription });
      router.refresh();
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
        <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-[600] text-text">{label}</span>
          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{description}</p>
        {locked && <p className="mt-1 text-[11.5px] text-text-3">{lockedReason ?? "Managed by Phila for your practice."}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending || locked}
        aria-label={`${on ? "Turn off" : "Turn on"} ${label.toLowerCase()}`}
        onClick={toggle}
        className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60", on ? "bg-accent" : "bg-border-strong")}
      >
        <span className={cn("size-5 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
      </button>
    </div>
  );
}
