"use client";

import { useState, useTransition } from "react";
import { Bot, Video, MessageCircle, Smartphone, CreditCard, HandCoins, Share2, Power } from "lucide-react";
import type { FeatureMeta } from "@/lib/domain/features";
import type { OrgFeature } from "@/lib/domain/enums";
import { useToast } from "@/components/ui/toast";
import { setPlatformFeature } from "@/app/admin/features/actions";
import { cn } from "@/lib/utils";

const ICON: Record<OrgFeature, typeof Bot> = {
  ai: Bot, video: Video, whatsapp: MessageCircle, sms: Smartphone, payments: CreditCard, funders: HandCoins, referrals: Share2,
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
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={disabled}
            className={cn("inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50", disabled ? "bg-danger" : "bg-surface-2")}
          >
            <span className={cn("size-5 rounded-full bg-surface shadow-sm transition-transform", disabled && "translate-x-5")} />
          </button>
        ) : (
          <span className="text-[11px] text-text-3">Always on</span>
        )}
      </div>
    </div>
  );
}
