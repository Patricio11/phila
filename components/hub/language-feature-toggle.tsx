"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveOrgFeature } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * Language of record (Phase 32.0) - the practice's own switch. Off = the whole
 * language layer disappears (booking step, dossier field, chips, matching) and
 * the system behaves exactly as before 32.0. Anything already recorded is kept,
 * never deleted (HPCSA records rule). The super-admin holds a platform
 * kill-switch + per-org override above this toggle.
 */
export function LanguageFeatureToggle({ initial, locked, lockedReason }: { initial: boolean; locked?: boolean; lockedReason?: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () => {
    if (locked) return toast({ tone: "error", title: lockedReason ?? "This switch is managed by Phila." });
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await saveOrgFeature({ feature: "language", enabled: next });
      if (!res.ok) { setOn(!next); return toast({ tone: "error", title: res.error }); }
      toast({
        tone: "default",
        title: next ? "Language of record on" : "Language of record off",
        description: next
          ? "Clients can share a home language, counsellors list what they speak, and matching prefers a speaker."
          : "Hidden from booking, dossiers and matching. Anything already recorded is kept.",
      });
      router.refresh();
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
        <Languages className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-[600] text-text">Language of record</span>
          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
          Ask each client their home language, let counsellors list the languages they speak, and prefer a
          matching counsellor when booking. Turn off to run exactly as before  nothing recorded is lost.
        </p>
        {locked && <p className="mt-1 text-[11.5px] text-text-3">{lockedReason ?? "Managed by Phila for your practice."}</p>}
      </div>
      <Switch checked={on} onChange={toggle} disabled={pending || locked} label={`${on ? "Turn off" : "Turn on"} language of record`} className="mt-0.5" />
    </div>
  );
}
