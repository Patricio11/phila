"use client";

import { useState, useTransition } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveOrgAiSettings } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

export function AiSettingsCard({ initial, spentCents, providerLive }: { initial: { aiEnabled: boolean; monthlyCapCents: number }; spentCents: number; providerLive: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.aiEnabled);
  const [capRands, setCapRands] = useState(String(Math.round(initial.monthlyCapCents / 100)));

  const save = () => start(async () => {
    const n = Number(capRands);
    if (!Number.isInteger(n) || n < 0) return toast({ tone: "error", title: "Enter a whole-rand cap." });
    const res = await saveOrgAiSettings({ aiEnabled: enabled, monthlyCapRands: n });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "AI settings saved" });
  });

  const spentR = (spentCents / 100).toFixed(0);

  return (
    <div className="space-y-3">
      {!providerLive && (
        <div className="rounded-control border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">
          The AI provider isn&apos;t switched on by Phila yet, so the scribe stays dormant even if you enable it here.
        </div>
      )}

      <button
        type="button" onClick={() => setEnabled((v) => !v)} aria-pressed={enabled}
        className={cn("flex w-full items-start gap-3 rounded-card border p-3.5 text-left transition-colors", enabled ? "border-accent/40 bg-accent-soft/30" : "border-border bg-surface hover:bg-surface-hover")}
      >
        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}><Sparkles className="size-4" strokeWidth={2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-[660] text-text">AI scribe {enabled ? "on" : "off"}</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-2">
            Turning this on is your <b>cross-border processing consent</b> (POPIA s.72): session cues are de-identified, then a draft note + funder fields come back. The counsellor always edits and signs  the AI never signs, sends, or changes clinical state.
          </p>
        </div>
        <span className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors", enabled ? "bg-accent" : "bg-border")}>
          <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-1")} />
        </span>
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ai-cap">Monthly budget (R)</Label>
          <Input id="ai-cap" inputMode="numeric" value={capRands} onChange={(e) => setCapRands(e.target.value)} />
        </div>
        <div className="flex items-end">
          <div className="flex items-center gap-2 rounded-control border border-border bg-surface-2/40 px-3 py-2 text-[12.5px]">
            <ShieldCheck className="size-4 text-text-2" strokeWidth={2} aria-hidden />
            <span className="text-text-2">Used this month: <b className="text-text">R{spentR}</b></span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={pending}>Save</Button>
      </div>
    </div>
  );
}
