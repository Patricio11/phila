"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, ListPlus, UserRound, X } from "lucide-react";
import type { WaitlistItem } from "@/db/queries/waitlist";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CreateAppointmentModal, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { placeWaitlist, removeFromWaitlist } from "@/app/hub/waitlist/actions";

function waitingSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  return `${Math.floor(days / 7)} weeks`;
}

/**
 * Waitlist (W7) — clients waiting for a slot. When a session is cancelled they're
 * auto-offered the freed slot by message; here the practice can also **book** one in
 * one tap (a prefilled appointment) or remove them. Booking marks them placed.
 */
export function WaitlistCard({ initial, options }: { initial: WaitlistItem[]; options: SchedulingOptions }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [booking, setBooking] = useState<WaitlistItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  if (items.length === 0) return null;
  const drop = (id: string) => setItems((prev) => prev.filter((r) => r.id !== id));

  const remove = (r: WaitlistItem) => {
    setBusy(r.id);
    start(async () => {
      const res = await removeFromWaitlist({ id: r.id });
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      drop(r.id);
      toast({ tone: "default", title: "Removed from waitlist", description: `${r.clientName.split(" ")[0]} taken off the list.` });
    });
  };

  const onBooked = (r: WaitlistItem) => {
    void placeWaitlist({ id: r.id });
    drop(r.id);
    toast({ tone: "success", title: "Booked from the waitlist", description: `${r.clientName.split(" ")[0]} placed.` });
  };

  return (
    <Card>
      <CardHead title="Waitlist" count={items.length} action={<span className="text-[12px] text-text-3">offered a slot when one frees up</span>} />
      <div className="space-y-2 px-[17px] pb-[17px]">
        {items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-border bg-surface-2/30 px-3.5 py-2.5">
            <span className="text-text-3"><UserRound className="size-4" strokeWidth={2} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-[620] text-text">{r.clientName}</div>
              <div className="text-[12px] text-text-3">
                {r.counsellorName ? `Prefers ${r.counsellorName}` : "Any counsellor"} · waiting {waitingSince(r.createdAt)}
                {r.offeredAt ? " · offered a slot" : ""}
                {r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={() => setBooking(r)}>
                <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden /> Book
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r)} disabled={busy === r.id} title="Remove from waitlist">
                <X className="size-3.5" strokeWidth={2} aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <CreateAppointmentModal
        key={booking?.id ?? "none"}
        open={booking !== null}
        onClose={() => setBooking(null)}
        options={options}
        initial={booking ? { clientId: booking.clientId, counsellorId: booking.counsellorId ?? undefined, serviceId: booking.serviceId ?? undefined } : undefined}
        onCreated={() => { if (booking) onBooked(booking); }}
      />
    </Card>
  );
}

/** Icon reused by the add-to-waitlist button so imports stay tidy. */
export const WaitlistAddIcon = ListPlus;
