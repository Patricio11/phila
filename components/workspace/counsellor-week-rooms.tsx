"use client";

import { Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const HOUR_PX = 44;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Assignment { roomName: string; colour: string; days: number[]; start: string; end: string }

function hm(t: string): number { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }
function minutesOf(iso: string): number { return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)); }
function hhmm(iso: string): string { return iso.slice(11, 16); }

/**
 * The counsellor's week in rooms — where they're assigned to work (room bands)
 * and their in-person bookings within, so the gaps are visible at a glance.
 */
export function CounsellorWeekRooms({
  days,
  businessHours,
  assignments,
  bookings,
}: {
  days: { date: string; dow: number; isToday: boolean }[];
  businessHours: BusinessHours;
  assignments: Assignment[];
  bookings: AppointmentView[];
}) {
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
            const dayAssignments = assignments.filter((a) => a.days.includes(d.dow));
            const dayBookings = bookings.filter((b) => b.startsAt.startsWith(d.date));
            return (
              <div key={d.date} className="border-l border-border first:border-l-0">
                <div className={cn("flex h-9 items-center justify-center gap-1.5 border-b border-border text-[12px]", d.isToday && "bg-accent-soft/30")}>
                  <span className={cn("font-medium uppercase", d.isToday ? "text-accent" : "text-text-3")}>{DOW[d.dow - 1]}</span>
                </div>
                <div className="relative" style={{ height: gridH }}>
                  {/* hour lines + closed shading */}
                  {hours.map((h) => {
                    const open = bh && h >= Number(bh.start.slice(0, 2)) && h < Number(bh.end.slice(0, 2));
                    return <div key={h} className={cn("border-b border-border/60", !open && "bg-surface-2/50")} style={{ height: HOUR_PX }} />;
                  })}
                  {/* assignment bands */}
                  {dayAssignments.map((a, i) => {
                    const top = ((hm(a.start) - startHour * 60) / 60) * HOUR_PX;
                    const height = ((hm(a.end) - hm(a.start)) / 60) * HOUR_PX;
                    return (
                      <div key={i} className="absolute inset-x-0.5 rounded-[6px] border px-1.5 pt-1" style={{ top, height, borderColor: `${a.colour}40`, background: `${a.colour}14` }}>
                        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: a.colour }}>{a.roomName}</div>
                      </div>
                    );
                  })}
                  {/* bookings */}
                  {dayBookings.map((b) => {
                    const top = ((minutesOf(b.startsAt) - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(20, (b.durationMin / 60) * HOUR_PX - 2);
                    return (
                      <div key={b.id} className="absolute inset-x-1 z-10 overflow-hidden rounded-[6px] border border-border bg-surface px-1.5 py-1 shadow-sm" style={{ top, height }}>
                        <div className="flex items-center gap-1 text-[10.5px] font-semibold tabular-nums leading-tight text-text">
                          {hhmm(b.startsAt)}{b.type === "online" && <Video className="size-2.5 text-info" strokeWidth={2.5} aria-hidden />}
                        </div>
                        <div className="truncate text-[11px] font-medium leading-tight text-text">{b.clientName}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
