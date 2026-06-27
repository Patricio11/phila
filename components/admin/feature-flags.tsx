"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Flag {
  key: string;
  label: string;
  description: string;
  on: boolean;
  caution?: boolean;
}

const INITIAL: Flag[] = [
  { key: "signups", label: "Self-serve org sign-ups", description: "Let new organisations create an account without an invite.", on: true },
  { key: "public", label: "Public org pages & booking", description: "Org micro-sites are indexable and accept bookings.", on: true },
  { key: "funder_portal", label: "Funder portal", description: "Orgs can invite funders to a scoped, read-only portal.", on: true },
  { key: "onboarding", label: "Industry-in-a-box onboarding", description: "Preconfigure services, intake, and report templates by sector.", on: true },
  { key: "maintenance", label: "Maintenance mode", description: "Show a maintenance banner and pause writes platform-wide.", on: false, caution: true },
];

export function FeatureFlags() {
  const { toast } = useToast();
  const [flags, setFlags] = useState(INITIAL);

  const toggle = (key: string) => {
    setFlags((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const on = !f.on;
        toast({ tone: f.caution && on ? "error" : "default", title: `${f.label} ${on ? "on" : "off"}`, description: f.caution && on ? "Writes are paused platform-wide." : undefined });
        return { ...f, on };
      }),
    );
  };

  return (
    <div className="space-y-2.5">
      {flags.map((f) => (
        <div key={f.key} className={cn("flex items-start gap-3 rounded-card border p-4", f.on && f.caution ? "border-danger/30 bg-danger-soft/30" : "border-border bg-surface")}>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-[600] text-text">{f.label}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{f.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={f.on}
            aria-label={`${f.on ? "Turn off" : "Turn on"} ${f.label}`}
            onClick={() => toggle(f.key)}
            className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors", f.on ? (f.caution ? "bg-danger" : "bg-accent") : "bg-border-strong")}
          >
            <span className={cn("inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform", f.on ? "translate-x-4" : "translate-x-0")}>
              {f.on ? <Check className={cn("size-3", f.caution ? "text-danger" : "text-accent")} strokeWidth={3} aria-hidden /> : null}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
