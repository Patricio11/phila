"use client";

import { useState, useTransition } from "react";
import { Mail, MessageCircle, Pencil, RotateCcw, Smartphone } from "lucide-react";
import type { TemplateView } from "@/db/queries/messaging";
import { type Channel, type MessageTrigger, renderTemplate, EMAIL_SUBJECTS } from "@/lib/messaging/templates";
import { WHATSAPP_TEMPLATE_PARAM_KEYS } from "@/lib/messaging/whatsapp-window";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveMessageTemplate, resetMessageTemplate } from "@/app/hub/settings/notifications/actions";
import { cn } from "@/lib/utils";

const TRIGGER_LABEL: Record<MessageTrigger, string> = {
  booked: "Booking confirmed", rescheduled: "Rescheduled", cancelled: "Cancelled", reminder: "Reminder", no_show: "No-show follow-up",
  document_shared: "Document shared with client", client_uploaded_document: "Client uploaded a document", form_sent: "Form sent to client",
  waitlist_slot: "Waitlist — slot opened",
};
const CHANNEL_META: Record<Channel, { label: string; icon: typeof Mail }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle }, sms: { label: "SMS", icon: Smartphone }, email: { label: "Email", icon: Mail },
};
const TOKENS = ["clientName", "practiceName", "serviceName", "counsellorName", "date", "time", "documentName", "formName", "formLink"];
const TRIGGERS: MessageTrigger[] = ["booked", "rescheduled", "cancelled", "reminder", "no_show", "document_shared", "client_uploaded_document", "form_sent", "waitlist_slot"];
const CHANNELS: Channel[] = ["whatsapp", "sms", "email"];

export function TemplateManager({ templates, practiceName }: { templates: TemplateView[]; practiceName: string }) {
  const sample = {
    clientName: "Lerato", practiceName, serviceName: "Individual counselling",
    counsellorName: "Nomsa", date: "Mon 6 Jul", time: "10:00",
  };
  const find = (channel: Channel, key: MessageTrigger) => templates.find((t) => t.channel === channel && t.key === key)!;

  return (
    <div className="space-y-4">
      {TRIGGERS.map((key) => (
        <div key={key} className="rounded-card border border-border bg-surface-2/30">
          <div className="border-b border-border px-3.5 py-2 text-[12px] font-[660] text-text">{TRIGGER_LABEL[key]}</div>
          <div className="divide-y divide-border">
            {CHANNELS.map((channel) => (
              <TemplateRow key={channel} tpl={find(channel, key)} sample={sample} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-text-3">Available tokens: {TOKENS.map((t) => `{${t}}`).join(" · ")}. WhatsApp/SMS keep it short; replies still reach you.</p>
    </div>
  );
}

function TemplateRow({ tpl, sample }: { tpl: TemplateView; sample: Record<string, string> }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(tpl.body);
  const [waName, setWaName] = useState(tpl.whatsappTemplateName ?? "");
  const { label, icon: Icon } = CHANNEL_META[tpl.channel];

  const save = () => start(async () => {
    const res = await saveMessageTemplate({ channel: tpl.channel, key: tpl.key, body, whatsappTemplateName: waName });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    tpl.body = body; tpl.whatsappTemplateName = waName || null; tpl.isOverride = true;
    setEditing(false);
    toast({ tone: "success", title: "Template saved" });
  });

  const reset = () => start(async () => {
    const res = await resetMessageTemplate({ channel: tpl.channel, key: tpl.key });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Reset to Phila default", description: "Reload to see the default wording." });
    setEditing(false);
  });

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-text-2"><Icon className="size-3.5" strokeWidth={2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-[600] text-text">{label}</span>
            {tpl.isOverride && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">Customised</span>}
          </div>
          {!editing && <p className="mt-1 whitespace-pre-line text-[12.5px] leading-snug text-text-2">{renderTemplate(tpl.body, sample)}</p>}
        </div>
        {!editing && (
          <Button variant="mini" onClick={() => { setBody(tpl.body); setWaName(tpl.whatsappTemplateName ?? ""); setEditing(true); }}>
            <Pencil className="size-3.5" strokeWidth={2} aria-hidden /> Edit
          </Button>
        )}
      </div>

      {editing && (
        <div className="mt-2.5 space-y-2.5 pl-8">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={tpl.channel === "email" ? 6 : 3} aria-label={`${label} message`} />
          {tpl.channel === "whatsapp" && (
            <div className="space-y-1.5">
              <input
                value={waName}
                onChange={(e) => setWaName(e.target.value)}
                placeholder="Meta-approved template name (for sends outside the 24h window)"
                aria-label="WhatsApp template name"
                className="h-9 w-full rounded-control border border-border bg-surface px-2.5 text-[12.5px] text-text placeholder:text-text-3"
              />
              <p className="text-[11px] leading-snug text-text-3">
                Inside a client&apos;s free 24-hour window we send the message above. Outside it, Meta only allows a pre-approved <b>template</b> — name it here, and build its body with placeholders in this order:{" "}
                {WHATSAPP_TEMPLATE_PARAM_KEYS.map((k, i) => `{{${i + 1}}} ${k}`).join(" · ")}.
              </p>
            </div>
          )}
          <div className="rounded-control border border-border bg-surface px-3 py-2">
            <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-3">Preview{tpl.channel === "email" ? ` · ${EMAIL_SUBJECTS[tpl.key]}` : ""}</div>
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-snug text-text">{renderTemplate(body, sample)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} loading={pending}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
            {tpl.isOverride && (
              <Button variant="ghost" size="sm" onClick={reset} disabled={pending} className={cn("ml-auto text-text-3")}>
                <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden /> Reset to default
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
