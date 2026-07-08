"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, MessageCircle, UserX } from "lucide-react";
import type { NoShowRow } from "@/db/queries/no-shows";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CreateAppointmentModal, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { resolveNoShow, sendNoShowFollowUp } from "@/app/app/appointments/actions";

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

/**
 * No-show follow-up (W7) — a missed session should never fall through the cracks.
 * Each unhandled no-show can be **rebooked** in one tap (a prefilled new appointment),
 * nudged (a "we missed you" message), or marked done. Booking or dismissing clears it.
 */
export function NoShowFollowUps({ initial, options }: { initial: NoShowRow[]; options: SchedulingOptions }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [rebooking, setRebooking] = useState<NoShowRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  if (items.length === 0) return null;

  const drop = (id: string) => setItems((prev) => prev.filter((r) => r.appointmentId !== id));

  const dismiss = (r: NoShowRow) => {
    setBusy(r.appointmentId);
    start(async () => {
      const res = await resolveNoShow({ appointmentId: r.appointmentId });
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      drop(r.appointmentId);
      toast({ tone: "default", title: "Marked done", description: `${r.clientName.split(" ")[0]} cleared from follow-ups.` });
    });
  };

  const nudge = (r: NoShowRow) => {
    setBusy(r.appointmentId);
    start(async () => {
      const res = await sendNoShowFollowUp({ appointmentId: r.appointmentId });
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Follow-up sent", description: `${r.clientName.split(" ")[0]} was invited to rebook.` });
    });
  };

  const onRebooked = (r: NoShowRow) => {
    // The session was rebooked → clear this no-show from the list (best-effort mark).
    void resolveNoShow({ appointmentId: r.appointmentId });
    drop(r.appointmentId);
  };

  return (
    <Card className="border-warn/40">
      <CardHead title="Missed sessions to follow up" count={items.length} />
      <div className="space-y-2 px-[17px] pb-[17px]">
        {items.map((r) => (
          <div key={r.appointmentId} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-border bg-surface-2/30 px-3.5 py-2.5">
            <span className="text-warn"><UserX className="size-4" strokeWidth={2} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-[620] text-text">{r.clientName}</div>
              <div className="text-[12px] text-text-3">Missed {whenLabel(r.startsAt)}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={() => setRebooking(r)}>
                <CalendarClock className="size-3.5" strokeWidth={2} aria-hidden /> Rebook
              </Button>
              <Button size="sm" variant="ghost" onClick={() => nudge(r)} disabled={busy === r.appointmentId} title="Send a rebook reminder">
                <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(r)} disabled={busy === r.appointmentId} title="Mark done">
                <Check className="size-3.5" strokeWidth={2} aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Keyed so the modal remounts per no-show — its initial client/service/counsellor apply. */}
      <CreateAppointmentModal
        key={rebooking?.appointmentId ?? "none"}
        open={rebooking !== null}
        onClose={() => setRebooking(null)}
        options={options}
        initial={rebooking ? { clientId: rebooking.clientId, counsellorId: rebooking.counsellorId, serviceId: rebooking.serviceId } : undefined}
        onCreated={() => { if (rebooking) onRebooked(rebooking); }}
      />
    </Card>
  );
}
