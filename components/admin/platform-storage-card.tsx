"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, HardDrive, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveStorageConfig, testStorageConnectionAction } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";

export function PlatformStorageCard({ initial }: { initial: { enabled: boolean; configured: boolean; url: string; bucket: string; anonKey: string; jwtConfigured: boolean; realtimePrivate: boolean } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [url, setUrl] = useState(initial.url);
  const [bucket, setBucket] = useState(initial.bucket);
  const [serviceKey, setServiceKey] = useState("");
  const [anonKey, setAnonKey] = useState(initial.anonKey);
  const [jwtSecret, setJwtSecret] = useState("");
  const [jwtConfigured, setJwtConfigured] = useState(initial.jwtConfigured);
  const [realtimePrivate, setRealtimePrivate] = useState(initial.realtimePrivate);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [configured, setConfigured] = useState(initial.configured);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);

  const save = (nextEnabled: boolean) =>
    start(async () => {
      const res = await saveStorageConfig({ url, bucket, serviceKey, anonKey, jwtSecret, realtimePrivate, enabled: nextEnabled });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEnabled(nextEnabled);
      if (serviceKey) setConfigured(true);
      if (jwtSecret) setJwtConfigured(true);
      setServiceKey("");
      setJwtSecret("");
      toast({ tone: "success", title: nextEnabled ? "Phila Storage switched on" : "Saved" });
    });

  const runTest = () =>
    startTest(async () => {
      const res = await testStorageConnectionAction({ url, bucket, serviceKey });
      setTest(res);
      toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Connection OK" : "Connection failed", description: res.detail });
    });

  const canAct = Boolean((url && bucket && serviceKey) || configured);

  return (
    <div className={cn("rounded-card border p-4", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
          <HardDrive className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-[660] text-text">
            Phila Storage · Supabase
            {enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent">
                <CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Live
              </span>
            ) : (
              configured && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>
            )}
          </div>
          <div className="text-[11.5px] text-text-3">The platform file store for documents. Use a <strong>private</strong> bucket; client files rest here, served only via signed URLs.</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Project URL</Label>
          <Input value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }} placeholder="https://xxxx.supabase.co" />
        </div>
        <div className="space-y-1">
          <Label>Bucket</Label>
          <Input value={bucket} onChange={(e) => { setBucket(e.target.value); setTest(null); }} placeholder="documents" />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Label>Service-role key</Label>
        <Input type="password" value={serviceKey} onChange={(e) => { setServiceKey(e.target.value); setTest(null); }} placeholder={configured ? "•••••• (leave blank to keep)" : "service_role secret"} />
      </div>
      <div className="mt-3 space-y-1">
        <Label>Anon (public) key</Label>
        <Input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJ… (public — used by the chat for live delivery + presence)" />
        <p className="text-[11px] text-text-3">Supabase → Project Settings → API → <strong>anon public</strong>. Safe in the browser; powers real-time messaging &amp; online presence.</p>
      </div>

      <div className="mt-4 rounded-control border border-border bg-surface-2/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-[640] text-text">Private realtime channels (RLS)</div>
            <p className="mt-0.5 text-[11px] text-text-3">Hardening: only thread members can subscribe. <strong>First run the setup SQL</strong> (docs/SUPABASE_REALTIME_SETUP.md) + paste the JWT secret, then switch on. If chat goes quiet after enabling, switch it off.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={realtimePrivate}
            aria-label="Private realtime channels"
            onClick={() => setRealtimePrivate((v) => !v)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", realtimePrivate ? "bg-accent" : "bg-surface-2")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", realtimePrivate ? "translate-x-[22px]" : "translate-x-0.5")} />
          </button>
        </div>
        <div className="mt-2 space-y-1">
          <Label>Supabase JWT secret</Label>
          <Input type="password" value={jwtSecret} onChange={(e) => setJwtSecret(e.target.value)} placeholder={jwtConfigured ? "•••••• (leave blank to keep)" : "Project Settings → API → JWT Secret"} />
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
          <Button size="sm" onClick={() => save(true)} loading={pending} disabled={!canAct}>Switch on</Button>
        )}
      </div>
    </div>
  );
}
