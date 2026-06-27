"use client";

import { useState } from "react";
import { Check, KeyRound, Lock, Zap } from "lucide-react";
import type { AiRailConfig } from "@/lib/mock/types";
import { Card, CardHead } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { key: "anthropic", label: "Anthropic" },
  { key: "openai", label: "OpenAI" },
  { key: "bedrock", label: "AWS Bedrock" },
] as const;

const STATUSES = ["off", "mock", "live"] as const;

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

/**
 * The platform AI rail — a single platform-held key every org uses (no BYO). The
 * **s.72 cross-border acknowledgement gates "live"**: AI cannot go live until the
 * operator confirms de-identification, a zero-retention provider, and no audio
 * storage (Data-Residency Rule). Mock here; Phase 14 wires the real provider.
 */
export function AiRail({ initial }: { initial: AiRailConfig }) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState(initial);

  const setStatus = (status: AiRailConfig["status"]) => {
    if (status === "live" && !cfg.s72Acknowledged) {
      toast({ tone: "error", title: "Acknowledge POPIA s.72 first", description: "AI can't go live until cross-border processing is acknowledged." });
      return;
    }
    setCfg((c) => ({ ...c, status }));
    toast({ tone: "default", title: `AI rail set to ${status}`, description: status === "off" ? "Nothing leaves." : status === "mock" ? "Drafts are simulated." : "Live — de-identified, zero-retention." });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHead title="Provider & key" action={<StatusPill status={cfg.status} />} />
        <div className="space-y-4 px-[17px] pb-[17px]">
          <div>
            <Label>Provider</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setCfg((c) => ({ ...c, provider: p.key }))}
                  className={cn("h-9 rounded-control border px-3 text-[13px] font-medium transition-colors", cfg.provider === p.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-key">Platform API key</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
              <Input id="ai-key" type="password" defaultValue="sk-************************" className="pl-9" />
            </div>
            <p className="flex items-center gap-1.5 text-[11.5px] text-text-3">
              <Lock className="size-3.5" strokeWidth={2} aria-hidden /> Stored encrypted, used server-side only. Every org uses this key — no BYO.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Model</Label>
              <Input id="ai-model" value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-max">Max tokens</Label>
              <Input id="ai-max" inputMode="numeric" value={String(cfg.maxTokens)} onChange={(e) => setCfg((c) => ({ ...c, maxTokens: Number(e.target.value.replace(/[^\d]/g, "") || 0) }))} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => toast({ tone: "success", title: "Test connection passed" })}>
              <Zap className="size-4" strokeWidth={2} aria-hidden /> Test connection
            </Button>
            <Button onClick={() => toast({ tone: "success", title: "AI rail saved" })}>Save</Button>
          </div>
        </div>
      </Card>

      {/* s.72 gate + status */}
      <Card>
        <CardHead title="Cross-border processing (POPIA s.72)" />
        <div className="space-y-4 px-[17px] pb-[17px]">
          <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={cfg.s72Acknowledged}
              onClick={() => setCfg((c) => ({ ...c, s72Acknowledged: !c.s72Acknowledged, status: !c.s72Acknowledged ? c.status : c.status === "live" ? "mock" : c.status }))}
              className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors", cfg.s72Acknowledged ? "bg-accent" : "bg-border-strong")}
            >
              <span className={cn("inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform", cfg.s72Acknowledged ? "translate-x-4" : "translate-x-0")}>
                {cfg.s72Acknowledged ? <Check className="size-3 text-accent" strokeWidth={3} aria-hidden /> : null}
              </span>
            </button>
            <span className="text-[12.5px] leading-relaxed text-text-2">
              I acknowledge that AI inference is <span className="font-medium text-text">de-identified before any cross-border call</span>,
              uses a <span className="font-medium text-text">zero-data-retention</span> provider, and that
              <span className="font-medium text-text"> audio is never stored</span>. The per-org AI toggle remains the consent gate.
            </span>
          </label>

          <div>
            <Label>Rail status</Label>
            <div className="mt-1.5 inline-flex rounded-control border border-border p-0.5">
              {STATUSES.map((s) => {
                const disabled = s === "live" && !cfg.s72Acknowledged;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setStatus(s)}
                    className={cn("h-8 rounded-[6px] px-4 text-[12.5px] font-medium capitalize transition-colors disabled:opacity-40", cfg.status === s ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {!cfg.s72Acknowledged && <p className="mt-1.5 text-[11.5px] text-text-3">Live is disabled until s.72 is acknowledged.</p>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Spend & caps" />
        <div className="grid grid-cols-2 gap-3 px-[17px] pb-[17px]">
          <div className="rounded-control bg-surface-2 p-3">
            <div className="text-[18px] font-bold tabular-nums text-text">{rands(cfg.monthlySpendCents)}</div>
            <div className="text-[11.5px] text-text-3">Platform AI spend this month</div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-cap">Default per-org monthly cap (R)</Label>
            <Input id="ai-cap" inputMode="numeric" value={String(Math.round(cfg.defaultOrgCapCents / 100))} onChange={(e) => setCfg((c) => ({ ...c, defaultOrgCapCents: Number(e.target.value.replace(/[^\d]/g, "") || 0) * 100 }))} className="h-9" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: AiRailConfig["status"] }) {
  const cls = status === "live" ? "bg-accent-soft text-accent" : status === "mock" ? "bg-warn-soft text-warn" : "bg-surface-2 text-text-3";
  return <span className={cn("rounded-chip px-2 py-0.5 text-[11px] font-semibold capitalize", cls)}>{status}</span>;
}
