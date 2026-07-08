"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CalendarX, Check, X } from "lucide-react";
import type { PendingChangeRequest } from "@/db/queries/appointment-requests";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resolveChangeRequest } from "@/app/hub/appointments/actions";

/** When a session starts, in friendly SAST. */
function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Pending client change requests (W6.2) — the practice's queue. Approving a cancellation
 * cancels the session; approving a reschedule acknowledges it (staff then move it in the
 * calendar). Declining tells the client to get in touch.
 */
export function ChangeRequestsCard({ initial }: { initial: PendingChangeRequest[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  if (items.length === 0) return null;

  const act = (id: string, decision: "approve" | "decline") => {
    setBusy(id);
    start(async () => {
      const res = await resolveChangeRequest({ requestId: id, decision });
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setItems((prev) => prev.filter((r) => r.id !== id));
      toast({ tone: "success", title: decision === "approve" ? "Request approved" : "Request declined", description: "The client has been notified." });
    });
  };

  return (
    <Card className="border-warn/40">
      <CardHead title="Client change requests" count={items.length} />
      <div className="space-y-2.5 px-[17px] pb-[17px]">
        {items.map((r) => {
          const isCancel = r.kind === "cancel";
          return (
            <div key={r.id} className="rounded-control border border-border bg-surface-2/30 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={isCancel ? "text-danger" : "text-accent"}>
                  {isCancel ? <CalendarX className="size-4" strokeWidth={2} aria-hidden /> : <CalendarClock className="size-4" strokeWidth={2} aria-hidden />}
                </span>
                <span className="text-[13.5px] font-[620] text-text">{r.clientName}</span>
                <span className="text-[12.5px] text-text-2">wants to {isCancel ? "cancel" : "reschedule"}</span>
                <span className="ml-auto text-[12px] tabular-nums text-text-3">{whenLabel(r.startsAt)}</span>
              </div>
              <p className="mt-2 rounded-control bg-surface px-3 py-2 text-[12.5px] italic leading-relaxed text-text-2">“{r.reason}”</p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" onClick={() => act(r.id, "approve")} loading={busy === r.id}>
                  <Check className="size-4" strokeWidth={2.4} aria-hidden /> {isCancel ? "Cancel session" : "Approve"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act(r.id, "decline")} disabled={busy === r.id}>
                  <X className="size-4" strokeWidth={2} aria-hidden /> Decline
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
