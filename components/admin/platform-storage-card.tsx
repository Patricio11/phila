"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, Globe, HardDrive, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveStorageConfig, testStorageConnectionAction, getStorageCorsState, applyStorageCors } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

type Backend = "supabase" | "s3";

/**
 * Batch 2o - Phila Storage has two backends. Supabase or Amazon S3 (and any
 * S3-compatible store): pick one, configure it, test it, switch it on. Files
 * already written keep the backend they were written to, so switching never
 * orphans what a practice has uploaded, and either way the bytes count against
 * that practice's storage allowance.
 */
export function PlatformStorageCard({ initial }: { initial: {
  enabled: boolean; configured: boolean; url: string; bucket: string; anonKey: string;
  jwtConfigured: boolean; realtimePrivate: boolean;
  provider?: Backend;
  s3?: { region: string; bucket: string; accessKeyId: string; endpoint: string; configured: boolean };
} }) {
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
  const [provider, setProvider] = useState<Backend>(initial.provider ?? "supabase");
  const [s3Region, setS3Region] = useState(initial.s3?.region ?? "");
  const [s3Bucket, setS3Bucket] = useState(initial.s3?.bucket ?? "");
  const [s3AccessKeyId, setS3AccessKeyId] = useState(initial.s3?.accessKeyId ?? "");
  const [s3Secret, setS3Secret] = useState("");
  const [s3Endpoint, setS3Endpoint] = useState(initial.s3?.endpoint ?? "");
  const [s3Configured, setS3Configured] = useState(Boolean(initial.s3?.configured));
  const isS3 = provider === "s3";

  const save = (nextEnabled: boolean) =>
    start(async () => {
      const res = await saveStorageConfig({
        provider, url, bucket, serviceKey, anonKey, jwtSecret, realtimePrivate, enabled: nextEnabled,
        s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey: s3Secret, s3Endpoint,
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEnabled(nextEnabled);
      if (serviceKey) setConfigured(true);
      if (jwtSecret) setJwtConfigured(true);
      if (s3Secret) setS3Configured(true);
      setServiceKey("");
      setJwtSecret("");
      setS3Secret("");
      toast({
        tone: "success",
        title: nextEnabled ? "Phila Storage switched on (" + (isS3 ? "Amazon S3" : "Supabase") + ")" : "Saved",
        description: nextEnabled ? "New uploads go here. Files already stored stay where they are and keep working." : undefined,
      });
    });

  const runTest = () =>
    startTest(async () => {
      const res = await testStorageConnectionAction({
        provider, url, bucket, serviceKey,
        s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey: s3Secret, s3Endpoint,
      });
      setTest(res);
      toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Connection OK" : "Connection failed", description: res.detail });
    });

  const canAct = isS3
    ? Boolean((s3Region && s3Bucket && s3AccessKeyId && s3Secret) || s3Configured)
    : Boolean((url && bucket && serviceKey) || configured);

  return (
    <div className={cn("rounded-card border p-4", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
          <HardDrive className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-[660] text-text">
            Phila Storage · {isS3 ? "Amazon S3" : "Supabase"}
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

      {/* Which backend holds the bytes. One at a time; the other stays configured. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {([
          { key: "supabase" as const, label: "Supabase", ready: configured },
          { key: "s3" as const, label: "Amazon S3", ready: s3Configured },
        ]).map((pv) => (
          <button
            key={pv.key}
            type="button"
            onClick={() => { setProvider(pv.key); setTest(null); }}
            aria-pressed={provider === pv.key}
            className={cn(
              "inline-flex h-[28px] items-center gap-1.5 rounded-chip border px-2.5 text-[12px] font-medium transition-colors",
              provider === pv.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
            )}
          >
            {pv.label}
            {pv.ready && provider !== pv.key && <span className="text-[10.5px] opacity-70">configured</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-text-3">
        New uploads go to the chosen backend and count against each practice&apos;s storage allowance. Files already stored keep the
        backend they were written to, so switching never breaks an existing document, logo or photo.
      </p>

      {isS3 ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Region</Label>
              <Input aria-label="Region" value={s3Region} onChange={(e) => { setS3Region(e.target.value); setTest(null); }} placeholder="af-south-1" />
            </div>
            <div className="space-y-1">
              <Label>Bucket</Label>
              <Input aria-label="Bucket" value={s3Bucket} onChange={(e) => { setS3Bucket(e.target.value); setTest(null); }} placeholder="phila-documents" />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Access key ID</Label>
              <Input aria-label="Access key ID" value={s3AccessKeyId} onChange={(e) => { setS3AccessKeyId(e.target.value); setTest(null); }} placeholder="AKIA..." />
            </div>
            <div className="space-y-1">
              <Label>Secret access key</Label>
              <Input aria-label="Secret access key" type="password" value={s3Secret} onChange={(e) => { setS3Secret(e.target.value); setTest(null); }} placeholder={s3Configured ? "(leave blank to keep)" : "secret access key"} />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Label>Endpoint (optional)</Label>
            <Input aria-label="Endpoint" value={s3Endpoint} onChange={(e) => { setS3Endpoint(e.target.value); setTest(null); }} placeholder="Leave blank for AWS. Set for MinIO / Cloudflare R2." />
            <p className="text-[11px] text-text-3">
              Keep the bucket <strong>private</strong> and in-region (af-south-1 for South African data residency). Phila only ever hands out short-lived signed URLs.
            </p>
          </div>
          {/* Batch 4l - browser uploads need the bucket's CORS rule */}
          {s3Configured && <CorsPanel />}
        </>
      ) : (
      <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Project URL</Label>
          <Input aria-label="Project URL" value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }} placeholder="https://xxxx.supabase.co" />
        </div>
        <div className="space-y-1">
          <Label>Bucket</Label>
          <Input aria-label="Supabase bucket" value={bucket} onChange={(e) => { setBucket(e.target.value); setTest(null); }} placeholder="documents" />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Label>Service-role key</Label>
        <Input aria-label="Service-role key" type="password" value={serviceKey} onChange={(e) => { setServiceKey(e.target.value); setTest(null); }} placeholder={configured ? "•••••• (leave blank to keep)" : "service_role secret"} />
      </div>
      <div className="mt-3 space-y-1">
        <Label>Anon (public) key</Label>
        <Input aria-label="Anon public key" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJ… (public  used by the chat for live delivery + presence)" />
        <p className="text-[11px] text-text-3">Supabase → Project Settings → API → <strong>anon public</strong>. Safe in the browser; powers real-time messaging &amp; online presence.</p>
      </div>

      <div className="mt-4 rounded-control border border-border bg-surface-2/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-[640] text-text">Private realtime channels (RLS)</div>
            <p className="mt-0.5 text-[11px] text-text-3">Hardening: only thread members can subscribe. <strong>First run the setup SQL</strong> (docs/SUPABASE_REALTIME_SETUP.md) + paste the JWT secret, then switch on. If chat goes quiet after enabling, switch it off.</p>
          </div>
          <Switch checked={realtimePrivate} onChange={() => setRealtimePrivate((v) => !v)} label="Private realtime channels" />
        </div>
        <div className="mt-2 space-y-1">
          <Label>Supabase JWT secret</Label>
          <Input aria-label="Supabase JWT secret" type="password" value={jwtSecret} onChange={(e) => setJwtSecret(e.target.value)} placeholder={jwtConfigured ? "•••••• (leave blank to keep)" : "Project Settings → API → JWT Secret"} />
        </div>
      </div>
      </>
      )}

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

/**
 * Batch 4l - "Browser uploads". A browser PUTs files straight to the bucket, so
 * the bucket must allow the app's origin (CORS) - without it every upload dies
 * on the preflight with a 403. Phila reads the rule, sets it in one click when
 * the key may, and otherwise hands over the exact JSON for the AWS console.
 */
function CorsPanel() {
  const { toast } = useToast();
  const [state, setState] = useState<Awaited<ReturnType<typeof getStorageCorsState>> | null>(null);
  const [busy, startBusy] = useTransition();
  const load = () => getStorageCorsState().then(setState).catch(() => setState(null));
  useEffect(() => { void load(); }, []);
  const apply = () => startBusy(async () => {
    const res = await applyStorageCors();
    if (!res.ok) { toast({ tone: "error", title: "Couldn't set the rule", description: res.error }); await load(); return; }
    toast({ tone: "success", title: "Browser uploads allowed", description: `From ${res.origins.join(" and ")}.` });
    await load();
  });
  const json = state ? JSON.stringify(state.rule, null, 2) : "";
  const copy = () => { void navigator.clipboard?.writeText(json); toast({ tone: "default", title: "CORS rule copied", description: "Paste it under the bucket's Permissions → Cross-origin resource sharing (CORS)." }); };
  const tone = !state ? "muted" : state.satisfied ? "ok" : "warn";
  return (
    <div className={cn("mt-3 rounded-control border p-3", tone === "ok" ? "border-accent/30 bg-accent-soft/20" : tone === "warn" ? "border-warn/40 bg-warn-soft/30" : "border-border bg-surface-2/40")} data-testid="s3-cors">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className={cn("size-4", tone === "ok" ? "text-accent" : tone === "warn" ? "text-warn" : "text-text-3")} strokeWidth={2} aria-hidden />
        <span className="text-[12.5px] font-[640] text-text">Browser uploads</span>
        {!state ? (
          <span className="text-[11.5px] text-text-3">checking the bucket&apos;s CORS rule…</span>
        ) : state.satisfied ? (
          <span className="text-[11.5px] text-text-2">Allowed from {state.required.join(" · ")}</span>
        ) : (
          <span className="text-[11.5px] text-warn">{state.ok ? `Not allowed yet - the bucket ${state.allowed.length ? `only allows ${state.allowed.join(", ")}` : "has no CORS rule"}. Uploads from the browser will fail with a 403 on the preflight.` : state.detail}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {state && !state.satisfied && (
            <Button size="sm" onClick={apply} loading={busy}>Allow uploads from Phila</Button>
          )}
          <Button size="sm" variant="ghost" onClick={copy} disabled={!state}><Copy className="size-3.5" strokeWidth={2} aria-hidden /> Copy rule</Button>
        </div>
      </div>
      {state && !state.satisfied && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-3">
          One click sets it with this access key (needs <code>s3:PutBucketCors</code>). If the key isn&apos;t allowed to, paste the copied rule in the AWS console: S3 → your bucket → Permissions → Cross-origin resource sharing (CORS).
        </p>
      )}
    </div>
  );
}
