"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Cloud, Plug, Server, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveLivekitConfig, testLivekitConnection } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";

type Provider = "selfhosted" | "cloud";
type CredsIn = { wsUrl: string; apiKey: string; configured: boolean };
const SH_DEFAULTS = { wsUrl: "ws://localhost:7880", apiKey: "devkey" };

const META: Record<Provider, { label: string; icon: typeof Server; wsPlaceholder: string; keyPlaceholder: string; secretPlaceholder: string }> = {
  selfhosted: { label: "Phila (self-hosted)", icon: Server, wsPlaceholder: "ws://localhost:7880", keyPlaceholder: "devkey", secretPlaceholder: "your server secret" },
  cloud: { label: "LiveKit Cloud", icon: Cloud, wsPlaceholder: "wss://your-project.livekit.cloud", keyPlaceholder: "API…", secretPlaceholder: "your Cloud API secret" },
};

export function PlatformVideoCard({ initial }: { initial: { enabled: boolean; provider: Provider; sh: CredsIn; cloud: CredsIn } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();

  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [sh, setSh] = useState({ wsUrl: initial.sh.wsUrl, apiKey: initial.sh.apiKey, apiSecret: "" });
  const [cloud, setCloud] = useState({ wsUrl: initial.cloud.wsUrl, apiKey: initial.cloud.apiKey, apiSecret: "" });
  const [configured, setConfigured] = useState<Record<Provider, boolean>>({ selfhosted: initial.sh.configured, cloud: initial.cloud.configured });
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);

  const cur = provider === "cloud" ? cloud : sh;
  const setCur = (patch: Partial<typeof cur>) => (provider === "cloud" ? setCloud : setSh)((p) => ({ ...p, ...patch }));
  const meta = META[provider];
  const curConfigured = configured[provider];
  const canAct = Boolean(cur.wsUrl && cur.apiKey && (cur.apiSecret || curConfigured));

  const pickProvider = (p: Provider) => {
    setProvider(p);
    setTest(null);
    if (p === "selfhosted" && !sh.wsUrl) setSh((s) => ({ ...s, wsUrl: SH_DEFAULTS.wsUrl, apiKey: SH_DEFAULTS.apiKey }));
  };

  const save = (nextEnabled: boolean) => start(async () => {
    const res = await saveLivekitConfig({ provider, sh, cloud, enabled: nextEnabled });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setEnabled(nextEnabled);
    if (sh.apiSecret) setConfigured((c) => ({ ...c, selfhosted: true }));
    if (cloud.apiSecret) setConfigured((c) => ({ ...c, cloud: true }));
    setSh((s) => ({ ...s, apiSecret: "" }));
    setCloud((s) => ({ ...s, apiSecret: "" }));
    toast({ tone: "success", title: nextEnabled ? `Video on · ${META[provider].label}` : "Saved" });
  });

  const runTest = () => startTest(async () => {
    const res = await testLivekitConnection({ provider, wsUrl: cur.wsUrl, apiKey: cur.apiKey, apiSecret: cur.apiSecret });
    setTest(res);
    toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Connection OK" : "Connection failed", description: res.detail });
  });

  return (
    <div className={cn("rounded-card border p-4", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}><Video className="size-4" strokeWidth={2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-[660] text-text">
            Video rooms · LiveKit
            {enabled
              ? <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> On · {META[provider].label}</span>
              : (configured.selfhosted || configured.cloud) && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>}
          </div>
          <div className="text-[11.5px] text-text-3">Secure in-region video for online sessions. Same secure token flow either way  pick where the server lives.</div>
        </div>
      </div>

      {/* Provider segmented control */}
      <div className="mt-3 inline-flex rounded-control border border-border bg-surface-2/60 p-0.5 text-[12.5px]">
        {(["selfhosted", "cloud"] as const).map((p) => {
          const Icon = META[p].icon;
          return (
            <button key={p} type="button" onClick={() => pickProvider(p)} className={cn("inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1 font-medium transition-colors", provider === p ? "bg-surface text-text shadow-sm" : "text-text-3 hover:text-text-2")}>
              <Icon className="size-3.5" strokeWidth={2} aria-hidden /> {META[p].label}
              {configured[p] && <span className="size-1.5 rounded-full bg-accent" aria-hidden />}
            </button>
          );
        })}
      </div>

      {provider === "cloud" && (
        <p className="mt-2 text-[11.5px] text-text-3">Paste the three values from your LiveKit Cloud project (Settings → Keys): the URL, API key, and API secret.</p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>WebSocket URL</Label>
          <Input value={cur.wsUrl} onChange={(e) => { setCur({ wsUrl: e.target.value }); setTest(null); }} placeholder={meta.wsPlaceholder} />
        </div>
        <div className="space-y-1">
          <Label>API key</Label>
          <Input value={cur.apiKey} onChange={(e) => { setCur({ apiKey: e.target.value }); setTest(null); }} placeholder={meta.keyPlaceholder} />
        </div>
        <div className="space-y-1">
          <Label>API secret</Label>
          <Input type="password" value={cur.apiSecret} onChange={(e) => { setCur({ apiSecret: e.target.value }); setTest(null); }} placeholder={curConfigured ? "•••••• (leave blank to keep)" : meta.secretPlaceholder} />
        </div>
      </div>

      {test && (
        <div className={cn("mt-2 flex items-center gap-1.5 text-[12px]", test.ok ? "text-accent" : "text-danger")}>
          {test.ok ? <CheckCircle2 className="size-3.5" strokeWidth={2.4} aria-hidden /> : <XCircle className="size-3.5" strokeWidth={2.4} aria-hidden />}
          {test.detail}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={runTest} loading={testing} disabled={!canAct}>
          <Plug className="size-3.5" strokeWidth={2} aria-hidden /> Test connection
        </Button>
        <div className="flex-1" />
        {enabled ? (
          <>
            <Button size="sm" onClick={() => save(true)} loading={pending}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={pending}>Switch off</Button>
          </>
        ) : (
          <Button size="sm" onClick={() => save(true)} loading={pending} disabled={!canAct}>Switch on · {META[provider].label}</Button>
        )}
      </div>
    </div>
  );
}
