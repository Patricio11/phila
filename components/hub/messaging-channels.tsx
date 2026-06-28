"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, Mail, MessageCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { connectChannel } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

type Channel = "whatsapp" | "sms" | "email";

interface ChannelDef {
  key: Channel;
  label: string;
  icon: typeof MessageCircle;
  blurb: string;
  providers: { value: string; label: string }[];
  fields: { key: string; label: string; placeholder: string }[];
}

const CHANNELS: ChannelDef[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    blurb: "Booking, reminder and follow-up messages on WhatsApp  your own Business number.",
    providers: [
      { value: "meta", label: "Meta WhatsApp Cloud API" },
      { value: "twilio", label: "Twilio" },
      { value: "360dialog", label: "360dialog" },
    ],
    fields: [
      { key: "phoneId", label: "Phone number ID", placeholder: "e.g. 1098…" },
      { key: "token", label: "Access token", placeholder: "Your provider token" },
    ],
  },
  {
    key: "sms",
    label: "SMS",
    icon: Smartphone,
    blurb: "SMS fallback for clients without WhatsApp  connect a South African SMS provider.",
    providers: [
      { value: "smsportal", label: "SMSPortal" },
      { value: "clickatell", label: "Clickatell" },
      { value: "twilio", label: "Twilio" },
    ],
    fields: [
      { key: "apiKey", label: "API key", placeholder: "Your provider API key" },
      { key: "sender", label: "Sender ID", placeholder: "e.g. MASIZAKHE" },
    ],
  },
  {
    key: "email",
    label: "Email",
    icon: Mail,
    blurb: "Confirmations, invoices and reports by email  from your own domain.",
    providers: [
      { value: "sendgrid", label: "SendGrid" },
      { value: "postmark", label: "Postmark" },
      { value: "smtp", label: "Custom SMTP" },
    ],
    fields: [
      { key: "apiKey", label: "API key", placeholder: "Your provider key" },
      { key: "from", label: "From address", placeholder: "hello@practice.co.za" },
    ],
  },
];

export function MessagingChannels() {
  return (
    <div className="space-y-2.5">
      {CHANNELS.map((c) => <ChannelRow key={c.key} def={c} />)}
      <p className="pt-1 text-[11px] text-text-3">Bring your own provider  credentials are stored encrypted and nothing sends until a channel is connected.</p>
    </div>
  );
}

function ChannelRow({ def }: { def: ChannelDef }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState<string | null>(def.providers[0]?.value ?? null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const connect = () => {
    start(async () => {
      const res = await connectChannel({ channel: def.key, provider: provider ?? "", fields: values });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setConnected(true);
      setOpen(false);
      toast({ tone: "success", title: `${def.label} connected`, description: "It's live the moment messaging turns on  test sends are recorded." });
    });
  };

  const providerName = def.providers.find((p) => p.value === provider)?.label ?? "";

  return (
    <div className={cn("rounded-control border bg-surface transition-colors", connected ? "border-accent/30" : "border-border")}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", connected ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
          <def.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-[600] text-text">{def.label}</span>
            <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", connected ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-text-2">{connected ? `${providerName} · clients reached on your number` : def.blurb}</p>
        </div>
        {connected ? <CheckCircle2 className="size-5 shrink-0 text-accent" strokeWidth={2} aria-hidden /> : <ChevronDown className={cn("size-4 shrink-0 text-text-3 transition-transform", open && "rotate-180")} aria-hidden />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3.5">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={provider} onChange={setProvider} options={def.providers} />
          </div>
          {def.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button size="sm" onClick={connect} loading={pending}>{connected ? "Update connection" : "Connect"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
