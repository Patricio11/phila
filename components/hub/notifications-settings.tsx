"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, Copy, HelpCircle, Mail, MessageCircle, Smartphone, Wallet } from "lucide-react";
import type { MessagingSettings, WhatsappConnectionView } from "@/db/queries/messaging";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveNotificationSettings, saveWhatsapp, requestWhatsappSetup } from "@/app/hub/settings/notifications/actions";
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
      {/* WhatsApp  BYO */}
      <ChannelShell
        icon={MessageCircle} title="WhatsApp" enabled={s.whatsappEnabled} onToggle={(v) => set("whatsappEnabled", v)}
        tag={whatsapp.status === "configured" || whatsapp.status === "live" ? "Connected" : "Your own number"}
      >
        <WhatsappCard whatsapp={whatsapp} />
      </ChannelShell>

      {/* SMS  Phila credits */}
      <ChannelShell
        icon={Smartphone} title="SMS" enabled={s.smsEnabled} onToggle={(v) => set("smsEnabled", v)} tag="Powered by Phila"
      >
        <CreditRow channel="SMS" balance={credits.sms} blurb="Sent via Phila's bulk SMS  no provider account needed." />
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
        <p className="mt-0.5 text-[11.5px] text-text-2">No messages send between these times (the client&apos;s wellbeing comes first). Leave blank for none.</p>
        <div className="mt-2 flex items-center gap-2">
          <Input type="time" value={s.quietStart ?? ""} onChange={(e) => set("quietStart", e.target.value)} aria-label="Quiet hours start" className="w-32" />
          <span className="text-[12px] text-text-3">to</span>
          <Input type="time" value={s.quietEnd ?? ""} onChange={(e) => set("quietEnd", e.target.value)} aria-label="Quiet hours end" className="w-32" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-text-3">Messages route to each client&apos;s preferred channel among the ones you enable. Opt-out always wins.</p>
        <Button onClick={save} loading={pending}>Save</Button>
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

function WhatsappCard({ whatsapp }: { whatsapp: WhatsappConnectionView }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(whatsapp.status === "off");
  const [phoneNumberId, setPhoneNumberId] = useState(whatsapp.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState(whatsapp.wabaId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState(whatsapp.verifyToken ?? "");

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp";

  const save = () => start(async () => {
    const res = await saveWhatsapp({ phoneNumberId, wabaId, accessToken, appSecret, verifyToken });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "WhatsApp connected", description: "Reload to see the connected status." });
    setOpen(false);
  });

  const help = () => start(async () => {
    await requestWhatsappSetup();
    toast({ tone: "success", title: "We'll help you set up", description: "Phila's team will reach out to get your WhatsApp Business number connected." });
  });

  if (!open && (whatsapp.status === "configured" || whatsapp.status === "live")) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-accent/30 bg-accent-soft/30 px-3 py-2.5">
        <CheckCircle2 className="size-5 text-accent" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-[640] text-text">Your WhatsApp number is connected</div>
          <div className="text-[11.5px] text-text-2">Phone number ID {whatsapp.phoneNumberId} · sends from your own Business number</div>
        </div>
        <Button variant="mini" onClick={() => setOpen(true)}>Edit</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11.5px] text-text-2">Connect your own <b>Meta WhatsApp Cloud API</b> number. Credentials are stored encrypted; nothing sends until it&apos;s connected.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Phone number ID" value={phoneNumberId} onChange={setPhoneNumberId} placeholder="e.g. 109876…" />
        <Field label="WhatsApp Business Account ID" value={wabaId} onChange={setWabaId} placeholder="e.g. 102233…" />
        <Field label="Access token" value={accessToken} onChange={setAccessToken} placeholder={whatsapp.hasToken ? "•••••• (leave blank to keep)" : "System user token"} />
        <Field label="App secret (optional)" value={appSecret} onChange={setAppSecret} placeholder={whatsapp.hasToken ? "•••••• (leave blank to keep)" : "Hardens the webhook"} />
        <Field label="Verify token" value={verifyToken} onChange={setVerifyToken} placeholder="Any secret string you choose" />
      </div>
      <div className="rounded-control border border-border bg-surface-2/40 px-3 py-2">
        <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-3">Webhook URL (add in Meta → Configuration)</div>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(webhookUrl); toast({ tone: "default", title: "Copied" }); }} className="mt-1 flex items-center gap-1.5 text-[12px] text-text hover:text-accent">
          <Copy className="size-3.5" strokeWidth={2} aria-hidden /> {webhookUrl}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} loading={pending}><Check className="size-3.5" strokeWidth={2} aria-hidden /> Save connection</Button>
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
