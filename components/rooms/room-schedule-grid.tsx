"use client";

import { useState } from "react";
import { Plus, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/domain/types";
import { CreateAppointmentModal, type CreateInitial, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { cn } from "@/lib/utils";

const HOUR_PX = 46;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function minutesOf(iso: string): number { return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)); }
function hhmm(iso: string): string { return iso.slice(11, 16); }

/**
 * RoomScheduleGrid (DESIGN.md §6)  one room's week: who's in it, when, and for
 * what, with the **gaps visible** as bookable availability. Click an open slot to
 * book straight into this room.
 */
export function RoomScheduleGrid({
  roomId,
  roomName,
  colour,
  days,
  businessHours,
  bookings,
  scheduling,
}: {
  roomId: string;
  roomName: string;
  colour: string;
  days: { date: string; dow: number; isToday: boolean }[];
  businessHours: BusinessHours;
  bookings: AppointmentView[];
  scheduling: SchedulingOptions;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [init, setInit] = useState<CreateInitial | null>(null);
  const [key, setKey] = useState(0);

  // Grid range from the week's business hours.
  let startHour = 23;
  let endHour = 0;
  for (const d of days) {
    const h = businessHours[d.dow as keyof BusinessHours];
    if (!h) continue;
    startHour = Math.min(startHour, Number(h.start.slice(0, 2)));
    endHour = Math.max(endHour, Number(h.end.slice(0, 2)) + (Number(h.end.slice(3, 5)) > 0 ? 1 : 0));
  }
  if (startHour > endHour) { startHour = 8; endHour = 17; }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridH = (endHour - startHour) * HOUR_PX;

  const openCreate = (date: string, time: string) => {
    setInit({ date, time, roomId, type: "In person" });
    setKey((k) => k + 1);
    setCreateOpen(true);
  };

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <div className="flex min-w-[620px]">
        <div className="w-12 shrink-0 pt-9">
          {hours.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_PX }}>
              <span className="absolute -top-2 right-2 text-[10.5px] tabular-nums text-text-3">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const bh = businessHours[d.dow as keyof BusinessHours];
            const dayBookings = bookings.filter((b) => b.startsAt.startsWith(d.date));
            return (
              <div key={d.date} className="border-l border-border first:border-l-0">
                <div className={cn("flex h-9 items-center justify-center gap-1.5 border-b border-border text-[12px]", d.isToday && "bg-accent-soft/30")}>
                  <span className={cn("font-medium uppercase", d.isToday ? "text-accent" : "text-text-3")}>{DOW[d.dow - 1]}</span>
                </div>
                <div className="relative" style={{ height: gridH }}>
                  {hours.map((h) => {
                    const open = bh && h >= Number(bh.start.slice(0, 2)) && h < Number(bh.end.slice(0, 2));
                    const inBreak = bh?.breaks?.some((b) => h >= Number(b.start.slice(0, 2)) && h < Number(b.end.slice(0, 2)));
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={!open || inBreak}
                        onClick={() => openCreate(d.date, `${String(h).padStart(2, "0")}:00`)}
                        aria-label={open && !inBreak ? `Book ${roomName} at ${h}:00` : undefined}
                        className={cn(
                          "group block w-full border-b border-border/60",
                          !open && "bg-surface-2/50",
                          inBreak && "bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--color-surface-2)_5px,var(--color-surface-2)_10px)]",
                          open && !inBreak && "hover:bg-accent-soft/30",
                        )}
                        style={{ height: HOUR_PX }}
                      >
                        {open && !inBreak && <Plus className="mx-auto size-4 text-accent opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} aria-hidden />}
                      </button>
                    );
                  })}
                  {/* Bookings */}
                  {dayBookings.map((b) => {
                    const top = ((minutesOf(b.startsAt) - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(20, (b.durationMin / 60) * HOUR_PX - 2);
                    return (
                      <div key={b.id} className="pointer-events-none absolute inset-x-0.5 z-10 overflow-hidden rounded-[6px] border px-1.5 py-1" style={{ top, height, borderColor: `${colour}55`, background: `${colour}1a` }}>
                        <div className="flex items-center gap-1 text-[10.5px] font-semibold tabular-nums leading-tight text-text">
                          {hhmm(b.startsAt)}{b.type === "online" && <Video className="size-2.5" strokeWidth={2.5} aria-hidden />}
                        </div>
                        <div className="truncate text-[11px] font-medium leading-tight text-text">{b.clientName}</div>
                        {height > 40 && <div className="truncate text-[10px] text-text-2">{b.counsellorName.split(" ")[0]}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CreateAppointmentModal key={key} open={createOpen} onClose={() => setCreateOpen(false)} options={scheduling} initial={init ?? undefined} />
    </div>
  );
}
