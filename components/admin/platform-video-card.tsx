"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Plug, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveLivekitConfig, testLivekitConnection } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";

type Mode = "demo" | "live";
const DEMO_DEFAULTS = { wsUrl: "ws://localhost:7880", apiKey: "devkey" };

export function PlatformVideoCard({ initial }: { initial: { enabled: boolean; configured: boolean; mode: Mode; wsUrl: string; apiKey: string } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [wsUrl, setWsUrl] = useState(initial.wsUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [apiSecret, setApiSecret] = useState("");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [configured, setConfigured] = useState(initial.configured);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);

  const pickMode = (m: Mode) => {
    setMode(m);
    setTest(null);
    if (m === "demo" && !wsUrl) { setWsUrl(DEMO_DEFAULTS.wsUrl); setApiKey(DEMO_DEFAULTS.apiKey); }
  };

  const save = (nextEnabled: boolean) => start(async () => {
    const res = await saveLivekitConfig({ mode, wsUrl, apiKey, apiSecret, enabled: nextEnabled });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setEnabled(nextEnabled);
    if (apiSecret) setConfigured(true);
    setApiSecret("");
    toast({ tone: "success", title: nextEnabled ? `Video switched on (${mode})` : "Saved" });
  });

  const runTest = () => startTest(async () => {
    const res = await testLivekitConnection({ wsUrl, apiKey, apiSecret });
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
              ? <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Live · {mode}</span>
              : configured && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>}
          </div>
          <div className="text-[11.5px] text-text-3">Secure in-region video for online sessions. Demo = self-hosted (Docker); Live = LiveKit Cloud.</div>
        </div>
      </div>

      {/* Mode segmented control */}
      <div className="mt-3 inline-flex rounded-control border border-border bg-surface-2/60 p-0.5 text-[12.5px]">
        {(["demo", "live"] as const).map((m) => (
          <button key={m} type="button" onClick={() => pickMode(m)} className={cn("rounded-[7px] px-3 py-1 font-medium capitalize transition-colors", mode === m ? "bg-surface text-text shadow-sm" : "text-text-3 hover:text-text-2")}>
            {m === "demo" ? "Demo (self-host)" : "Live (Cloud)"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>WebSocket URL</Label>
          <Input value={wsUrl} onChange={(e) => { setWsUrl(e.target.value); setTest(null); }} placeholder={mode === "demo" ? "ws://localhost:7880" : "wss://your-app.livekit.cloud"} />
        </div>
        <div className="space-y-1">
          <Label>API key</Label>
          <Input value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTest(null); }} placeholder={mode === "demo" ? "devkey" : "APIxxxx"} />
        </div>
        <div className="space-y-1">
          <Label>API secret</Label>
          <Input type="password" value={apiSecret} onChange={(e) => { setApiSecret(e.target.value); setTest(null); }} placeholder={configured ? "•••••• (leave blank to keep)" : mode === "demo" ? "secret" : "your live secret"} />
        </div>
      </div>

      {test && (
        <div className={cn("mt-2 flex items-center gap-1.5 text-[12px]", test.ok ? "text-accent" : "text-danger")}>
          {test.ok ? <CheckCircle2 className="size-3.5" strokeWidth={2.4} aria-hidden /> : <XCircle className="size-3.5" strokeWidth={2.4} aria-hidden />}
          {test.detail}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={runTest} loading={testing} disabled={!wsUrl || !apiKey || (!apiSecret && !configured)}>
          <Plug className="size-3.5" strokeWidth={2} aria-hidden /> Test connection
        </Button>
        <div className="flex-1" />
        {enabled ? (
          <>
            <Button size="sm" onClick={() => save(true)} loading={pending}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={pending}>Switch off</Button>
          </>
        ) : (
          <Button size="sm" onClick={() => save(true)} loading={pending} disabled={!wsUrl || !apiKey || (!apiSecret && !configured)}>Switch on</Button>
        )}
      </div>
    </div>
  );
}
