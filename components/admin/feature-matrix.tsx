"use client";

import { useState, useTransition } from "react";
import { Activity, Bot, Video, MessageCircle, Smartphone, CreditCard, HandCoins, ListChecks, Share2, Languages, Power } from "lucide-react";
import type { FeatureMeta } from "@/lib/domain/features";
import type { OrgFeature } from "@/lib/domain/enums";
import { useToast } from "@/components/ui/toast";
import { setPlatformFeature } from "@/app/admin/features/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const ICON: Record<OrgFeature, typeof Bot> = {
  ai: Bot, video: Video, whatsapp: MessageCircle, sms: Smartphone, payments: CreditCard, funders: HandCoins, referrals: Share2, language: Languages, waitlist: ListChecks, outcomes: Activity,
};

type Row = FeatureMeta & { disabled: boolean };

export function FeatureMatrix({ features }: { features: Row[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {features.map((f) => <FeatureCard key={f.key} feature={f} />)}
    </div>
  );
}

function FeatureCard({ feature }: { feature: Row }) {
  const { toast } = useToast();
  const [disabled, setDisabled] = useState(feature.disabled);
  const [pending, start] = useTransition();
  const Icon = ICON[feature.key];

  const toggle = () => {
    if (!feature.globallyDisableable) return;
    const next = !disabled;
    setDisabled(next);
    start(async () => {
      const res = await setPlatformFeature({ feature: feature.key, disabled: next });
      if (!res.ok) { setDisabled(!next); return toast({ tone: "error", title: res.error }); }
      toast({ tone: next ? "default" : "success", title: next ? `${feature.label} killed platform-wide` : `${feature.label} restored`, description: "Every org resolves this instantly." });
    });
  };

  return (
    <div className={cn("rounded-card border p-4 transition-colors", disabled ? "border-danger/30 bg-danger-soft/20" : "border-border bg-surface")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-control", disabled ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent")}>
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-[640] text-text">{feature.label}</span>
            <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-3">{feature.category}</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-2">{feature.description}</p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-border/70 pt-3">
        <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", disabled ? "text-danger" : "text-accent")}>
          <Power className="size-3.5" strokeWidth={2} aria-hidden />
          {disabled ? "Off across Phila" : "Available"}
        </span>
        {feature.globallyDisableable ? (
          <Switch checked={disabled} onChange={toggle} disabled={pending} tone="danger" label={disabled ? `Restore ${feature.label}` : `Turn ${feature.label} off across Phila`} />
        ) : (
          <span className="text-[11px] text-text-3">Always on</span>
        )}
      </div>
    </div>
  );
}
