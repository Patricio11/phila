"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PhoneCall, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { saveVoiceConfig, testVoiceConnection } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";

/**
 * Phase 33.2 - the VoicePhila rail. Twilio first, provider-swappable by
 * design; modes: Off (dormant), Mock (dev - calls simulate, nothing dials),
 * Live (real bridged calls on the shared number). Platform-keyed: orgs never
 * BYO a voice provider - they buy minutes.
 */
export function PlatformVoiceCard({ initial }: {
  initial: { mode: "off" | "mock" | "live"; configured: boolean; callerNumber: string };
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [callerNumber, setCallerNumber] = useState(initial.callerNumber);
  const [mode, setMode] = useState<"off" | "mock" | "live">(initial.mode);
  const [configured, setConfigured] = useState(initial.configured);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);

  const save = () =>
    start(async () => {
      const res = await saveVoiceConfig({ accountSid, authToken, callerNumber, mode });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      if ((accountSid && authToken) || mode === "mock") setConfigured(true);
      setAccountSid("");
      setAuthToken("");
      toast({
        tone: "success",
        title: mode === "live" ? "VoicePhila is LIVE" : mode === "mock" ? "VoicePhila in mock mode" : "VoicePhila saved (off)",
        description: mode === "live" ? "Bridged calls dial out on the shared number." : mode === "mock" ? "Calls simulate instantly - nothing dials out." : "Dormant - no org sees a voice surface.",
      });
    });

  const runTest = () =>
    startTest(async () => {
      const res = await testVoiceConnection({ accountSid, authToken, mode });
      setTest(res);
      toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Voice rail OK" : "Test failed", description: res.detail });
    });

  const live = mode === "live" && configured;

  return (
    <div className={cn("rounded-card border p-4", live ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", live ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
          <PhoneCall className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-[660] text-text">
            VoicePhila · Twilio
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent">
                <CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Live
              </span>
            ) : mode === "mock" ? (
              <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-medium text-warn">Mock</span>
            ) : (
              configured && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>
            )}
          </div>
          <div className="text-[11.5px] text-text-3">
            The platform bridges counsellor and client on the shared masked number; minutes are system-measured. Provider-swappable - Twilio first.
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Account SID</Label>
          <Input aria-label="Twilio Account SID" value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder={configured ? "•••••• saved" : "AC..."} />
        </div>
        <div className="space-y-1.5">
          <Label>Auth token</Label>
          <Input aria-label="Twilio auth token" type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder={configured ? "•••••• saved" : "token"} />
        </div>
        <div className="space-y-1.5">
          <Label>Shared caller number</Label>
          <Input aria-label="Shared caller number" inputMode="tel" value={callerNumber} onChange={(e) => setCallerNumber(e.target.value)} placeholder="+27 87 ..." />
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select
            ariaLabel="Voice mode"
            value={mode}
            onChange={(v) => v && setMode(v as "off" | "mock" | "live")}
            options={[
              { value: "off", label: "Off - dormant" },
              { value: "mock", label: "Mock - simulate, nothing dials" },
              { value: "live", label: "Live - real bridged calls" },
            ]}
          />
        </div>
      </div>

      {test && (
        <div className={cn("mt-3 flex items-start gap-2 rounded-control border px-3 py-2 text-[12.5px]", test.ok ? "border-accent/30 bg-accent-soft/40 text-text-2" : "border-danger/30 bg-danger-soft text-danger")}>
          {test.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />}
          {test.detail}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        <Button size="sm" onClick={save} loading={pending}>Save</Button>
        <Button size="sm" variant="ghost" onClick={runTest} loading={testing}>
          <Plug className="size-3.5" strokeWidth={2} aria-hidden /> Test connection
        </Button>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-text-3">
        No audio is ever recorded - only durations and attempts. Orgs buy VoicePhila minutes from the credit catalogue; nothing shows on any org until this rail is on AND a bundle is on sale.
      </p>
    </div>
  );
}
