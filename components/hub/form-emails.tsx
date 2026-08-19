"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import type { FormNotifySettings } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setFormNotify } from "@/app/hub/forms/actions";
import { DEFAULT_NOTIFY_SUBJECT, DEFAULT_NOTIFY_BODY, NOTIFY_TOKENS } from "@/lib/forms/notify-email";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * Batch 3j - the Emails tab. When someone completes this form, the practice
 * hears by email - and the org writes that email itself: recipients, subject,
 * body, with tokens filled in at send time.
 */
export function FormEmails({ formId, initial }: { formId: string; initial: FormNotifySettings | null }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(Boolean(initial?.enabled));
  const [recipients, setRecipients] = useState((initial?.recipients ?? []).join(", "));
  const [subject, setSubject] = useState(initial?.subject || DEFAULT_NOTIFY_SUBJECT);
  const [body, setBody] = useState(initial?.body || DEFAULT_NOTIFY_BODY);

  const parsedRecipients = recipients.split(",").map((r) => r.trim()).filter(Boolean);
  const badEmail = parsedRecipients.find((r) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));

  const save = () =>
    start(async () => {
      if (badEmail) return toast({ tone: "error", title: `"${badEmail}" doesn't look like an email address.` });
      const res = await setFormNotify({ formId, enabled, recipients: parsedRecipients, subject: subject.trim(), body: body.trim() });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({
        tone: "success",
        title: enabled ? "Submission emails on" : "Submission emails off",
        description: enabled
          ? parsedRecipients.length
            ? `Every submission emails ${parsedRecipients.length} address${parsedRecipients.length === 1 ? "" : "es"}.`
            : "Every submission emails all practice admins."
          : "Nobody is emailed when this form is submitted.",
      });
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3.5">
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-3")}>
            <Mail className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <div className="text-[13px] font-[640] text-text">Email the practice on every submission</div>
            <p className="text-[11.5px] leading-relaxed text-text-3">The moment anyone completes this form, the email below goes out. Leave recipients empty to reach every practice admin.</p>
          </div>
        </div>
        <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} label="Email the practice on every submission" />
      </div>

      <div className={cn("space-y-3 rounded-card border border-border bg-surface p-3.5", !enabled && "opacity-60")}>
        <div className="space-y-1.5">
          <Label>Send to</Label>
          <Input
            aria-label="Recipient emails"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="Leave empty for all practice admins - or comma-separate addresses"
            disabled={!enabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input aria-label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!enabled} />
        </div>
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea aria-label="Email body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[120px]" disabled={!enabled} />
          <p className="text-[11.5px] leading-relaxed text-text-3">
            Fills in as it sends: {NOTIFY_TOKENS.map((t, i) => (
              <span key={t}>
                <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-text-2">{t}</code>
                {i < NOTIFY_TOKENS.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} loading={pending}>Save email settings</Button>
        </div>
      </div>
    </div>
  );
}
