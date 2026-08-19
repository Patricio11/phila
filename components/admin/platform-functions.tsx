"use client";

import { useState, useTransition } from "react";
import { HeartHandshake, Power } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { setPlatformCrisisSupport } from "@/app/admin/features/actions";
import { cn } from "@/lib/utils";

/**
 * Batch 4m - "Platform functions": things Phila switches ON for practices (the
 * feature matrix above is the other way round - kill-switches over features orgs
 * choose themselves). Off until the super admin decides; every org follows
 * instantly; there is no org-level switch.
 */
export function PlatformFunctions({ crisisSupportEnabled }: { crisisSupportEnabled: boolean }) {
  const { toast } = useToast();
  const [on, setOn] = useState(crisisSupportEnabled);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await setPlatformCrisisSupport({ enabled: next });
      if (!res.ok) { setOn(!next); return toast({ tone: "error", title: res.error }); }
      toast({ tone: next ? "success" : "default", title: next ? "Crisis support switched on for practices" : "Crisis support switched off", description: next ? "Every practice has it now." : "Nothing is read and nothing is shown, anywhere." });
    });
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-[660] text-text">Platform functions</h2>
        <p className="text-[12.5px] text-text-2">Off until you switch them on. Once on, every practice has the function - practices don&apos;t see a switch for it.</p>
      </div>
      <div className={cn("rounded-card border p-4 transition-colors", on ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")} data-testid="platform-crisis-support">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-control", on ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
            <HeartHandshake className="size-[18px]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-[640] text-text">Crisis support in client conversations</span>
              <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-3">safety</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-2">
              When a client&apos;s message reads as self-harm it still sends exactly as written - never blocked, never held. The staff in that conversation and the practice&apos;s admins get a quiet bell (never the text), and <strong>SADAG 0800 567 567</strong> · <strong>SADAG SMS 31393</strong> · <strong>Lifeline 0861 322 322</strong> are shown to the author alone, once. A short, conservative phrase list - no AI, no model, nothing stored beyond the bell.
            </p>
          </div>
        </div>
        <div className="mt-3.5 flex items-center justify-between border-t border-border/70 pt-3">
          <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", on ? "text-accent" : "text-text-3")}>
            <Power className="size-3.5" strokeWidth={2} aria-hidden />
            {on ? "On for every practice" : "Off - nothing is read, nothing is shown"}
          </span>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            role="switch"
            aria-checked={on}
            aria-label="Crisis support in client conversations"
            className={cn("inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50", on ? "bg-accent" : "bg-surface-2")}
          >
            <span className={cn("size-5 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-5")} />
          </button>
        </div>
      </div>
    </section>
  );
}
