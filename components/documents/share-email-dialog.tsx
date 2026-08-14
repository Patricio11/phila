"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createShareEmailLink } from "@/app/hub/documents/actions";

/**
 * Batch 3p - "share these by email". One dialog for a selection of files or a
 * whole folder: recipient, a short note, how long the link lives. On success
 * it shows the link with Copy - and says honestly whether the email went out.
 */
export function ShareEmailDialog({
  open,
  onClose,
  documentIds,
  folderId,
  what,
  defaultEmail = null,
}: {
  open: boolean;
  onClose: () => void;
  documentIds: string[];
  folderId: string | null;
  /** Human label for what's being shared, e.g. `the "Acme Ltd" folder` or `3 files`. */
  what: string;
  defaultEmail?: string | null;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("14");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ url: string; emailed: boolean; count: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => { setResult(null); setNote(""); setCopied(false); onClose(); };

  const send = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return toast({ tone: "error", title: "Check the recipient's email address." });
    }
    setSending(true);
    try {
      const res = await createShareEmailLink({
        documentIds, folderId,
        recipientEmail: email.trim(),
        note: note.trim() || undefined,
        expiresDays: Number(days),
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setResult({ url: res.url, emailed: res.emailed, count: res.count });
    } finally {
      setSending(false);
    }
  };

  const copy = () => {
    if (!result) return;
    void navigator.clipboard?.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Share by email"
      description={result ? undefined : `A private download link for ${what} goes to the recipient.`}
      footer={
        result ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={close}>Done</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={close} disabled={sending}>Cancel</Button>
            <Button size="sm" onClick={() => void send()} loading={sending}>
              <Mail className="size-3.5" strokeWidth={2.2} aria-hidden /> Email the link
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="rounded-card border border-accent/30 bg-accent-soft/40 px-3.5 py-3 text-[13px] text-text">
            {result.emailed
              ? `Sent. ${email.trim()} received a link to ${result.count} item${result.count === 1 ? "" : "s"}.`
              : `The link is ready for ${result.count} item${result.count === 1 ? "" : "s"} - the email couldn't go out right now, so copy it and send it your way.`}
          </div>
          <div className="flex items-center gap-2">
            <Input readOnly value={result.url} aria-label="Share link" className="flex-1 font-mono text-[12px]" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="ghost" size="sm" onClick={copy}>
              {copied ? <Check className="size-4 text-accent" strokeWidth={2.2} aria-hidden /> : <Copy className="size-4" strokeWidth={2} aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-text-3">
            Anyone with the link can download until it expires ({days} days). Clinical documents are never shareable this way.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <Input autoFocus type="email" aria-label="Recipient email" placeholder="name@company.co.za" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea aria-label="Note to the recipient" placeholder="A line for the recipient - travels in the email and on the download page" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Link works for</Label>
            <Select
              value={days}
              onChange={(v) => v && setDays(v)}
              ariaLabel="Link expiry"
              options={[
                { value: "7", label: "7 days" },
                { value: "14", label: "14 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
