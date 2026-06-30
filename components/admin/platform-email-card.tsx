"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Mail, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveResendConfig, testResendConnection } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";

export function PlatformEmailCard({ initial }: { initial: { enabled: boolean; configured: boolean; from: string } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [from, setFrom] = useState(initial.from);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [configured, setConfigured] = useState(initial.configured);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);

  const save = (nextEnabled: boolean) =>
    start(async () => {
      const res = await saveResendConfig({ apiKey, from, enabled: nextEnabled });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEnabled(nextEnabled);
      if (apiKey) setConfigured(true);
      setApiKey("");
      toast({ tone: "success", title: nextEnabled ? "Resend switched on" : "Saved" });
    });

  const runTest = () =>
    startTest(async () => {
      const res = await testResendConnection({ apiKey, from });
      setTest(res);
      toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Connection OK" : "Connection failed", description: res.detail });
    });

  const canAct = Boolean((apiKey && from) || configured);

  return (
    <div className={cn("rounded-card border p-4", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
          <Mail className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-[660] text-text">
            Phila email · Resend
            {enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent">
                <CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Live
              </span>
            ) : (
              configured && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>
            )}
          </div>
          <div className="text-[11.5px] text-text-3">Sends from Phila&apos;s verified domain with the practice as display name + reply-to. Orgs buy Phila email credits.</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>API key</Label>
          <Input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTest(null); }} placeholder={configured ? "•••••• (leave blank to keep)" : "re_…"} />
        </div>
        <div className="space-y-1">
          <Label>From address</Label>
          <Input value={from} onChange={(e) => { setFrom(e.target.value); setTest(null); }} placeholder="notifications@phila.co.za" />
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
