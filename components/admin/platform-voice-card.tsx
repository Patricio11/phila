"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, FlaskConical, PhoneCall, Plug, Power, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveVoiceProviderConfig, testVoiceProvider, setActiveVoiceProvider } from "@/app/admin/integrations/actions";
import { cn } from "@/lib/utils";

type ProviderName = "mock" | "twilio" | "africastalking";

interface Initial {
  active: ProviderName | null;
  twilio: { accountSid: string; callerNumber: string; configured: boolean; tested: boolean };
  at: { username: string; callerNumber: string; configured: boolean; tested: boolean; webhookPath: string | null };
}

/**
 * Phase 33.9 - the VoicePhila provider SWITCHBOARD. Many providers configured,
 * exactly one active; a provider cannot go active until its Test passed (Mock
 * always may - it dials nothing). Switching is one guarded, audited action and
 * applies to NEW calls only - counsellors and orgs never see any of this, they
 * just tap "Call client".
 */
export function PlatformVoiceCard({ initial }: { initial: Initial }) {
  const { toast } = useToast();
  const [active, setActive] = useState<ProviderName | null>(initial.active);
  const [tw, setTw] = useState(initial.twilio);
  const [at, setAt] = useState(initial.at);
  const [twToken, setTwToken] = useState("");
  const [atKey, setAtKey] = useState("");
  const [twSid, setTwSid] = useState(initial.twilio.accountSid);
  const [atUser, setAtUser] = useState(initial.at.username);
  const [twNumber, setTwNumber] = useState(initial.twilio.callerNumber);
  const [atNumber, setAtNumber] = useState(initial.at.callerNumber);
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    start(async () => { try { await fn(); } finally { setBusyKey(null); } });
  };

  const saveTwilio = () => run("save-twilio", async () => {
    const res = await saveVoiceProviderConfig({ provider: "twilio", accountSid: twSid, authToken: twToken, callerNumber: twNumber });
    if (!res.ok) return void toast({ tone: "error", title: res.error });
    setTw((p) => ({ ...p, accountSid: twSid, callerNumber: twNumber, configured: Boolean(twSid && (twToken || p.configured)), tested: twToken || twSid !== initial.twilio.accountSid ? false : p.tested }));
    setTwToken("");
    if ((twToken || twSid) && active === "twilio") setActive(null);
    toast({ tone: "success", title: "Twilio saved", description: "Run its Test before making it active." });
  });

  const saveAt = () => run("save-at", async () => {
    const res = await saveVoiceProviderConfig({ provider: "africastalking", username: atUser, apiKey: atKey, callerNumber: atNumber });
    if (!res.ok) return void toast({ tone: "error", title: res.error });
    setAt((p) => ({ ...p, username: atUser, callerNumber: atNumber, configured: Boolean(atUser && (atKey || p.configured)), tested: atKey || atUser !== initial.at.username ? false : p.tested, webhookPath: res.atWebhookPath ?? p.webhookPath }));
    setAtKey("");
    if ((atKey || atUser) && active === "africastalking") setActive(null);
    toast({ tone: "success", title: "Africa's Talking saved", description: "Point the AT number's voice callback at the webhook URL below, then Test." });
  });

  const test = (p: ProviderName) => run(`test-${p}`, async () => {
    const res = await testVoiceProvider({ provider: p });
    if (p === "twilio") setTw((s) => ({ ...s, tested: res.ok }));
    if (p === "africastalking") setAt((s) => ({ ...s, tested: res.ok }));
    toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Test passed" : "Test failed", description: res.detail });
  });

  const activate = (p: ProviderName | null) => run(`activate-${p ?? "off"}`, async () => {
    const res = await setActiveVoiceProvider({ provider: p });
    if (!res.ok) return void toast({ tone: "error", title: "Can't switch", description: res.error });
    setActive(p);
    toast({ tone: p ? "success" : "default", title: p === null ? "VoicePhila switched off" : `VoicePhila now runs on ${p === "mock" ? "Mock" : p === "twilio" ? "Twilio" : "Africa's Talking"}`, description: p ? "New calls route here; calls already in progress finish on their own provider." : "The call button disappears for every practice." });
  });

  const copyWebhook = () => {
    if (!at.webhookPath) return;
    void navigator.clipboard?.writeText(`${window.location.origin}${at.webhookPath}`);
    toast({ tone: "default", title: "Webhook URL copied", description: "Paste it as the voice callback URL on your Africa's Talking number." });
  };

  const shell = (name: ProviderName, title: string, blurb: string, tested: boolean, configured: boolean, children?: React.ReactNode) => {
    const isActive = active === name;
    return (
      <div className={cn("rounded-card border p-4", isActive ? "border-accent/45 bg-accent-soft/20" : "border-border bg-surface")} data-testid={`voice-${name}`}>
        <div className="flex items-center gap-3">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", isActive ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
            {name === "mock" ? <FlaskConical className="size-4" strokeWidth={2} aria-hidden /> : <PhoneCall className="size-4" strokeWidth={2} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[14px] font-[660] text-text">
              {title}
              {isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Active - all calls route here</span>
              ) : tested ? (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Tested · standing by</span>
              ) : configured ? (
                <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-medium text-warn">Configured · untested</span>
              ) : (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-3">Not configured</span>
              )}
            </div>
            <div className="text-[11.5px] text-text-3">{blurb}</div>
          </div>
        </div>
        {children}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {name !== "mock" && (
            <Button variant="ghost" size="sm" onClick={() => test(name)} loading={busyKey === `test-${name}`} disabled={pending && busyKey !== `test-${name}`}>
              <Plug className="size-3.5" strokeWidth={2} aria-hidden /> Test connection
            </Button>
          )}
          <div className="flex-1" />
          {isActive ? (
            <Button variant="ghost" size="sm" onClick={() => activate(null)} loading={busyKey === "activate-off"} disabled={pending && busyKey !== "activate-off"}>
              <Power className="size-3.5" strokeWidth={2} aria-hidden /> Switch off
            </Button>
          ) : (
            <Button size="sm" onClick={() => activate(name)} loading={busyKey === `activate-${name}`} disabled={(name !== "mock" && !tested) || (pending && busyKey !== `activate-${name}`)} title={name !== "mock" && !tested ? "Run the Test first - a provider can't go live untested." : undefined}>
              Make active
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-text-2">
        Configure any provider; exactly <span className="font-[640] text-text">one is active</span>{" "}and carries every counsellor→client call, in every org.
        A provider can&apos;t go active until its Test passes; switching applies to <span className="font-[640] text-text">new calls only</span>{" "}and is audited.
        Practices never see any of this - their people just tap &quot;Call client&quot;.
      </p>

      {shell("mock", "Mock (dry run)", "No carrier, nothing dials out - calls simulate instantly. For development and demos.", true, true)}

      {shell("twilio", "Twilio", "Bridged calls on your Twilio SA number. Callbacks are signature-verified.", tw.tested, tw.configured, (<>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Account SID</Label><Input value={twSid} onChange={(e) => setTwSid(e.target.value)} placeholder="AC…" /></div>
          <div className="space-y-1"><Label>Auth token</Label><Input type="password" value={twToken} onChange={(e) => setTwToken(e.target.value)} placeholder={tw.configured ? "•••••• (leave blank to keep)" : "token"} /></div>
          <div className="space-y-1"><Label>Shared caller number</Label><Input value={twNumber} onChange={(e) => setTwNumber(e.target.value)} placeholder="+27…" /></div>
        </div>
        <div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" onClick={saveTwilio} loading={busyKey === "save-twilio"} disabled={pending && busyKey !== "save-twilio"}>Save Twilio</Button></div>
      </>))}

      {shell("africastalking", "Africa's Talking", 'Bridged calls on your AT SA number. Use username "sandbox" to run the SA validation checklist end to end before going live.', at.tested, at.configured, (<>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Username</Label><Input value={atUser} onChange={(e) => setAtUser(e.target.value)} placeholder="sandbox or your app username" /></div>
          <div className="space-y-1"><Label>API key</Label><Input type="password" value={atKey} onChange={(e) => setAtKey(e.target.value)} placeholder={at.configured ? "•••••• (leave blank to keep)" : "atsk_…"} /></div>
          <div className="space-y-1"><Label>Shared caller number</Label><Input value={atNumber} onChange={(e) => setAtNumber(e.target.value)} placeholder="+27…" /></div>
        </div>
        {at.webhookPath && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-2/50 px-3 py-2">
            <span className="text-[11.5px] text-text-2">Voice callback URL for your AT number:</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-text" data-testid="at-webhook-url">{at.webhookPath}</code>
            <Button variant="ghost" size="sm" onClick={copyWebhook}><Copy className="size-3.5" strokeWidth={2} aria-hidden /> Copy</Button>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-text-3">
          AT doesn&apos;t sign callbacks - the secret lives in that URL, and only calls Phila placed are ever bridged. Set the number&apos;s inbound handling to reject so it stays outbound-only.
        </p>
        <div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" onClick={saveAt} loading={busyKey === "save-at"} disabled={pending && busyKey !== "save-at"}>Save Africa&apos;s Talking</Button></div>
      </>))}

      {!active && (
        <div className="flex items-center gap-2 rounded-control border border-border bg-surface-2/40 px-3 py-2 text-[12px] text-text-2">
          <XCircle className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden /> VoicePhila is off - no practice sees a call button until a provider is made active.
        </div>
      )}
    </div>
  );
}
