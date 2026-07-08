"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CalendarX, Check, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { requestAppointmentChange } from "@/app/me/actions";

export type ChangeKind = "reschedule" | "cancel";

/**
 * The client's "ask the practice to change my session" control (W7 portal
 * reschedule/cancel). The client never edits the booking — they request a
 * reschedule or cancellation with a reason; `requestAppointmentChange` enforces
 * ownership + the org's notice window and notifies the practice. Shared by the
 * portal dashboard's next-session card AND every upcoming row in /me/sessions.
 */
export function RequestChangeControl({
  appointmentId,
  pendingKind = null,
}: {
  appointmentId: string;
  pendingKind?: ChangeKind | null;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState<ChangeKind | null>(pendingKind);
  const [dialog, setDialog] = useState<ChangeKind | null>(null);
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState<{ name: string; phone: string | null } | null>(null);
  const [submitting, startSubmit] = useTransition();

  const openDialog = (kind: ChangeKind) => { setDialog(kind); setReason(""); setContact(null); };

  const submit = () => {
    const kind = dialog;
    if (!kind || reason.trim().length < 5) return;
    startSubmit(async () => {
      const res = await requestAppointmentChange({ appointmentId, kind, reason: reason.trim() });
      if (!res.ok) {
        if (res.contact) { setContact(res.contact); return; }
        toast({ tone: "error", title: res.error });
        return;
      }
      setPending(kind);
      setDialog(null);
      toast({ tone: "success", title: kind === "cancel" ? "Cancellation requested" : "Reschedule requested", description: "The practice will be in touch to confirm." });
    });
  };

  if (pending) {
    return (
      <div className="flex items-start gap-2 rounded-control border border-border bg-surface-2/50 px-3 py-2.5 text-[12.5px] text-text-2">
        <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />
        <span>You&apos;ve asked to {pending === "cancel" ? "cancel" : "reschedule"} this session. The practice will be in touch to confirm.</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => openDialog("reschedule")}>
          <CalendarClock className="size-4" strokeWidth={2} aria-hidden /> Request reschedule
        </Button>
        <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => openDialog("cancel")}>
          <CalendarX className="size-4" strokeWidth={2} aria-hidden /> Request cancellation
        </Button>
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "cancel" ? "Request to cancel" : "Request to reschedule"}
        description="Tell us briefly why — the practice will confirm the change with you. Your session doesn't change until they do."
        footer={
          contact ? (
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setDialog(null)}>Close</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)} disabled={submitting}>Not now</Button>
              <Button onClick={submit} loading={submitting} disabled={reason.trim().length < 5}>Send request</Button>
            </div>
          )
        }
      >
        {contact ? (
          <div className="space-y-3">
            <p className="text-[13.5px] text-text-2">{contact.name} needs a little more notice for online changes. Please give them a call and they&apos;ll sort it out.</p>
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3.5 py-2.5 text-[14px] font-medium text-text transition-colors hover:bg-surface-hover">
                <Phone className="size-4 text-accent" strokeWidth={2} aria-hidden /> {contact.phone}
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="change-reason" className="text-[13px] font-medium text-text">Reason</label>
            <Textarea id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder={dialog === "cancel" ? "e.g. I'm not able to make this time anymore" : "e.g. Could we move to later in the week?"} autoFocus />
          </div>
        )}
      </Dialog>
    </>
  );
}
