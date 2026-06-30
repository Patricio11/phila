"use client";

import { useState, useTransition } from "react";
import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import type { AiProviderView } from "@/db/queries/ai";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveAiProviderConfig } from "@/app/admin/ai/actions";
import { cn } from "@/lib/utils";

const META: Record<string, { name: string; icon: typeof Bot; defaultModel: string; hint: string }> = {
  anthropic: { name: "Claude (Anthropic)", icon: Sparkles, defaultModel: "claude-sonnet-4-6", hint: "Strong, careful clinical writing. Request a ZDR (zero-retention) agreement for production." },
  openai: { name: "OpenAI", icon: Bot, defaultModel: "gpt-4o-mini", hint: "Fast + economical. Use a data-processing addendum / ZDR endpoint for production." },
};

export function AiProviders({ initial }: { initial: AiProviderView[] }) {
  return (
    <div className="space-y-3">
      {initial.map((p) => <ProviderCard key={p.provider} p={p} />)}
      <p className="text-[11px] text-text-3">One provider is active at a time. De-identification runs before every cross-border call; nothing is sent until an org also turns the scribe on (its POPIA consent gate).</p>
    </div>
  );
}

function ProviderCard({ p }: { p: AiProviderView }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const meta = META[p.provider]!;
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(p.model ?? meta.defaultModel);
  const [enabled, setEnabled] = useState(p.enabled);

  const save = (nextEnabled: boolean) => start(async () => {
    const res = await saveAiProviderConfig({ provider: p.provider, apiKey, model, enabled: nextEnabled });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setEnabled(nextEnabled);
    setApiKey("");
    toast({ tone: "success", title: nextEnabled ? `${meta.name} switched on` : `${meta.name} saved` });
  });

  return (
    <div className={cn("rounded-card border p-4", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}><meta.icon className="size-4" strokeWidth={2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-[660] text-text">{meta.name}{enabled && <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Active</span>}</div>
          <div className="text-[11.5px] text-text-3">{meta.hint}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>API key</Label>
          <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={p.hasKey ? "•••••• (leave blank to keep)" : `Your ${meta.name} key`} />
        </div>
        <div className="space-y-1">
          <Label>Model</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={meta.defaultModel} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {enabled ? (
          <>
            <Button size="sm" onClick={() => save(true)} loading={pending}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={pending}>Switch off</Button>
          </>
        ) : (
          <Button size="sm" onClick={() => save(true)} loading={pending} disabled={!apiKey && !p.hasKey}>Switch on</Button>
        )}
      </div>
    </div>
  );
}
