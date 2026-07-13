"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Check, CheckCircle2, ChevronDown, Copy, HelpCircle, Mail, MessageCircle, Smartphone, Wallet, Zap } from "lucide-react";
import type { MessagingSettings, WhatsappConnectionView } from "@/db/queries/messaging";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { useToast } from "@/components/ui/toast";
import { saveNotificationSettings, saveWhatsapp, requestWhatsappSetup, verifyWhatsappConnection } from "@/app/hub/settings/notifications/actions";
import { cn } from "@/lib/utils";

export function NotificationsSettings({
  settings, whatsapp, credits, practiceName,
}: {
  settings: MessagingSettings;
  whatsapp: WhatsappConnectionView;
  credits: { sms: number; email: number };
  practiceName: string;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [s, setS] = useState(settings);

  const set = <K extends keyof MessagingSettings>(k: K, v: MessagingSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const save = () => start(async () => {
    const res = await saveNotificationSettings({
      whatsappEnabled: s.whatsappEnabled, smsEnabled: s.smsEnabled, emailEnabled: s.emailEnabled,
      emailReplyTo: s.emailReplyTo ?? "", emailFromName: s.emailFromName ?? "",
      quietStart: s.quietStart ?? "", quietEnd: s.quietEnd ?? "",
    });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Notification settings saved" });
  });

  return (
    <div className="space-y-3">
      {/* WhatsApp — the headline channel (BYO number, free 24h window) */}
      <WhatsappHeadline whatsapp={whatsapp} enabled={s.whatsappEnabled} onToggle={(v) => set("whatsappEnabled", v)} />

      <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-text-3">Backup channels</div>

      {/* SMS  Phila credits */}
      <ChannelShell
        icon={Smartphone} title="SMS" enabled={s.smsEnabled} onToggle={(v) => set("smsEnabled", v)} tag="Powered by Phila"
      >
        <CreditRow channel="SMS" balance={credits.sms} blurb="For clients without WhatsApp. Sent via Phila's bulk SMS  no provider account needed." />
      </ChannelShell>

      {/* Email  Phila credits + reply-to */}
      <ChannelShell
        icon={Mail} title="Email" enabled={s.emailEnabled} onToggle={(v) => set("emailEnabled", v)} tag="Powered by Phila"
      >
        <CreditRow channel="Email" balance={credits.email} blurb={`Sent from Phila, shown as "${s.emailFromName || practiceName}". Replies go to your address below.`} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="from-name">Display name</Label>
            <Input id="from-name" value={s.emailFromName ?? ""} onChange={(e) => set("emailFromName", e.target.value)} placeholder={practiceName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reply-to">Reply-to email</Label>
            <Input id="reply-to" type="email" value={s.emailReplyTo ?? ""} onChange={(e) => set("emailReplyTo", e.target.value)} placeholder="reception@practice.co.za" />
          </div>
        </div>
      </ChannelShell>

      {/* Quiet hours */}
      <div className="rounded-card border border-border bg-surface-2/30 p-3.5">
        <div className="text-[12px] font-[660] text-text">Quiet hours</div>
        <p className="mt-0.5 text-[11.5px] text-text-2">No reminders send between these times (the client&apos;s wellbeing comes first). Leave blank for none.</p>
        <div className="mt-2 flex items-center gap-2">
          <TimePicker minuteStep={15} className="w-32" value={s.quietStart ?? ""} onChange={(v) => set("quietStart", v)} ariaLabel="Quiet hours start" />
          <span className="text-[12px] text-text-3">to</span>
          <TimePicker minuteStep={15} className="w-32" value={s.quietEnd ?? ""} onChange={(v) => set("quietEnd", v)} ariaLabel="Quiet hours end" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-text-3">Messages route to each client&apos;s preferred channel among the ones you enable. Opt-out always wins.</p>
        <Button onClick={save} loading={pending}>Save</Button>
      </div>
    </div>
  );
}

/* ---- WhatsApp headline -------------------------------------------------- */

function WhatsappHeadline({ whatsapp, enabled, onToggle }: { whatsapp: WhatsappConnectionView; enabled: boolean; onToggle: (v: boolean) => void }) {
  const connected = whatsapp.status === "configured" || whatsapp.status === "live";
  return (
    <div className="overflow-hidden rounded-card border border-accent/25 bg-gradient-to-br from-accent-soft/50 to-surface">
      <div className="flex items-start gap-3 p-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm"><MessageCircle className="size-[18px]" strokeWidth={2.2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-[680] text-text">WhatsApp</span>
            <span className="rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Primary channel</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-text-2">The channel South Africans actually answer — booking, reminders, and follow-ups from your own Business number.</p>
        </div>
        <Switch checked={enabled} onChange={onToggle} label="Enable WhatsApp" />
      </div>

      {/* The free-window value prop — the whole point of WhatsApp-first */}
      <div className="mx-4 mb-4 flex flex-col gap-2 rounded-control border border-accent/20 bg-surface/70 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 text-[12px] font-[620] text-text">
          <Zap className="size-4 text-accent" strokeWidth={2.2} aria-hidden /> Reminders in the free 24h window
        </div>
        <p className="text-[11.5px] leading-snug text-text-2">
          When a client has messaged you in the last 24 hours, replies and reminders are <b className="text-text">free</b>. Outside that window we use your Meta-approved template (a small per-message fee) — so a reminder never silently fails.
        </p>
      </div>

      <div className="border-t border-accent/15 bg-surface/60 p-4">
        <WhatsappCard whatsapp={whatsapp} connected={connected} />
      </div>
    </div>
  );
}

function ChannelShell({ icon: Icon, title, tag, enabled, onToggle, children }: { icon: typeof Mail; title: string; tag: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3.5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-surface-2 text-text-2"><Icon className="size-4" strokeWidth={2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-[660] text-text">{title}</div>
          <div className="text-[11.5px] text-text-3">{tag}</div>
        </div>
        <Switch checked={enabled} onChange={onToggle} label={`Enable ${title}`} />
      </div>
      {enabled && <div className="mt-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors", checked ? "bg-accent" : "bg-border")}
    >
      <span className={cn("inline-block size-4 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-1")} />
    </button>
  );
}

function CreditRow({ channel, balance, blurb }: { channel: string; balance: number; blurb: string }) {
  const { toast } = useToast();
  const low = balance < 20;
  return (
    <div className="flex items-center gap-3 rounded-control border border-border bg-surface-2/40 px-3 py-2.5">
      <Wallet className="size-4 text-text-2" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13px] font-[640]", low ? "text-warn" : "text-text")}>{balance} {channel} credits</div>
        <div className="text-[11.5px] text-text-3">{blurb}</div>
      </div>
      <Button
        variant="mini"
        onClick={() => toast({ tone: "default", title: "Self-serve top-ups arrive with billing", description: "For now, ask Phila to add credits  automatic purchase lands in Phase 15." })}
      >
        Buy credits
      </Button>
    </div>
  );
}

const SETUP_STEPS = [
  "In Meta Business Manager, add the WhatsApp product to your app and register your Business number.",
  "Copy the Phone Number ID and WhatsApp Business Account ID from the API Setup screen.",
  "Create a permanent System User access token with whatsapp_business_messaging permission.",
  "Add the webhook URL below in Meta → Configuration, using your verify token, and subscribe to the messages field.",
];

function WhatsappCard({ whatsapp, connected }: { whatsapp: WhatsappConnectionView; connected: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [open, setOpen] = useState(!connected);
  const [guide, setGuide] = useState(false);
  const [live, setLive] = useState<{ displayPhone?: string; name?: string; quality?: string } | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState(whatsapp.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState(whatsapp.wabaId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState(whatsapp.verifyToken ?? "");

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp";
  const copy = (text: string, what: string) => { void navigator.clipboard?.writeText(text); toast({ tone: "default", title: `${what} copied` }); };

  const save = () => start(async () => {
    const res = await saveWhatsapp({ phoneNumberId, wabaId, accessToken, appSecret, verifyToken });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "WhatsApp connected", description: "Reload to see the connected status, then test the connection." });
    setOpen(false);
  });

  const test = () => startTest(async () => {
    const res = await verifyWhatsappConnection();
    if (!res.ok) return toast({ tone: "error", title: "Test failed", description: res.error });
    setLive({ displayPhone: res.displayPhone, name: res.name, quality: res.quality });
    toast({ tone: "success", title: "Connection live", description: res.displayPhone ? `Reaching ${res.displayPhone}${res.name ? ` · ${res.name}` : ""}.` : "Your number responded." });
  });

  const help = () => start(async () => {
    await requestWhatsappSetup();
    toast({ tone: "success", title: "We'll help you set up", description: "Phila's team will reach out to get your WhatsApp Business number connected." });
  });

  if (!open && connected) {
    const verifiedLabel = whatsapp.verifiedAt ? new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(whatsapp.verifiedAt)) : null;
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-control border border-accent/30 bg-accent-soft/40 px-3 py-2.5">
          <CheckCircle2 className="size-5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-[640] text-text">
              Your WhatsApp number is connected
              {whatsapp.status === "live" && <span className="inline-flex items-center gap-1 rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent"><BadgeCheck className="size-3" strokeWidth={2.4} aria-hidden /> Verified</span>}
            </div>
            <div className="text-[11.5px] text-text-2">
              {live?.displayPhone ? <>Sending from <b className="text-text">{live.displayPhone}</b>{live.name ? ` · ${live.name}` : ""}{live.quality ? ` · quality ${live.quality.toLowerCase()}` : ""}</>
                : <>Phone number ID {whatsapp.phoneNumberId}{verifiedLabel ? ` · verified ${verifiedLabel}` : ""}</>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="mini" onClick={test} loading={testing}><Zap className="size-3.5" strokeWidth={2} aria-hidden /> Test</Button>
            <Button variant="mini" onClick={() => setOpen(true)}>Change</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11.5px] text-text-2">Connect your own <b>Meta WhatsApp Cloud API</b> number. Credentials are stored encrypted; nothing sends until it&apos;s connected.</p>

      <button type="button" onClick={() => setGuide((g) => !g)} className="flex w-full items-center gap-1.5 text-[11.5px] font-medium text-accent">
        <ChevronDown className={cn("size-3.5 transition-transform", guide && "rotate-180")} strokeWidth={2.2} aria-hidden /> How do I get these credentials?
      </button>
      {guide && (
        <ol className="ml-1 list-decimal space-y-1 pl-4 text-[11.5px] text-text-2">
          {SETUP_STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Phone number ID" value={phoneNumberId} onChange={setPhoneNumberId} placeholder="e.g. 109876…" />
        <Field label="WhatsApp Business Account ID" value={wabaId} onChange={setWabaId} placeholder="e.g. 102233…" />
        <Field label="Access token" value={accessToken} onChange={setAccessToken} placeholder={whatsapp.hasToken ? "•••••• (leave blank to keep)" : "System user token"} />
        <Field label="App secret (optional)" value={appSecret} onChange={setAppSecret} placeholder={whatsapp.hasToken ? "•••••• (leave blank to keep)" : "Hardens the webhook"} />
        <Field label="Verify token" value={verifyToken} onChange={setVerifyToken} placeholder="Any secret string you choose" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-control border border-border bg-surface-2/40 px-3 py-2">
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-3">Webhook URL (Meta → Configuration)</div>
          <button type="button" onClick={() => copy(webhookUrl, "Webhook URL")} className="mt-1 flex items-center gap-1.5 text-left text-[12px] text-text hover:text-accent">
            <Copy className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> <span className="truncate">{webhookUrl}</span>
          </button>
        </div>
        {verifyToken && (
          <div className="rounded-control border border-border bg-surface-2/40 px-3 py-2">
            <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-3">Verify token (paste in Meta)</div>
            <button type="button" onClick={() => copy(verifyToken, "Verify token")} className="mt-1 flex items-center gap-1.5 text-left text-[12px] text-text hover:text-accent">
              <Copy className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> <span className="truncate">{verifyToken}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} loading={pending}><Check className="size-3.5" strokeWidth={2} aria-hidden /> Save connection</Button>
        {whatsapp.hasToken && <Button variant="ghost" size="sm" onClick={test} loading={testing}><Zap className="size-3.5" strokeWidth={2} aria-hidden /> Test connection</Button>}
        <Button variant="ghost" size="sm" onClick={help} disabled={pending}><HelpCircle className="size-3.5" strokeWidth={2} aria-hidden /> Help me set up</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
