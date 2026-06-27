"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import type { BusinessHours } from "@/lib/mock/types";
import { isoWeekday, SAST_OFFSET } from "@/lib/mock/helpers";
import { rescheduleAppointment } from "@/app/app/calendar/actions";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const DOT: Record<AppointmentState, DotTone> = {
  scheduled: "grey",
  completed: "green",
  no_show: "amber",
  cancelled: "grey",
  rescheduled: "grey",
  postponed: "amber",
  discharged: "green",
  risk_flagged: "rose",
};

interface DayMeta {
  date: string; // YYYY-MM-DD
  dow: string;
  day: string;
  isToday: boolean;
}

function hourOf(iso: string): number {
  return Number(iso.slice(11, 13));
}
function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

export function CalendarWeek({
  days,
  businessHours,
  events: initialEvents,
}: {
  days: DayMeta[];
  businessHours: BusinessHours;
  events: AppointmentView[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [events, setEvents] = useState(initialEvents);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ appt: AppointmentView; newStart: string } | null>(null);

  // Grid hour range across the week's open days.
  const { startHour, endHour } = useMemo(() => {
    let s = 23;
    let e = 0;
    for (const d of days) {
      const h = businessHours[isoWeekday(d.date)];
      if (!h) continue;
      s = Math.min(s, Number(h.start.slice(0, 2)));
      e = Math.max(e, Number(h.end.slice(0, 2)) + (Number(h.end.slice(3, 5)) > 0 ? 1 : 0));
    }
    return { startHour: Math.min(s, 8), endHour: Math.max(e, 17) };
  }, [days, businessHours]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const cellEvents = (date: string, hour: number) =>
    events.filter((ev) => ev.startsAt.startsWith(date) && hourOf(ev.startsAt) === hour);

  const dayHours = (date: string) => businessHours[isoWeekday(date)];

  const onDrop = (date: string, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const appt = events.find((ev) => ev.id === id);
    if (!appt) return;
    const newStart = `${date}T${String(hour).padStart(2, "0")}:00:00${SAST_OFFSET}`;
    if (newStart === appt.startsAt) return;
    setConfirm({ appt, newStart });
  };

  const doReschedule = () => {
    if (!confirm) return;
    const { appt, newStart } = confirm;
    startTransition(async () => {
      const res = await rescheduleAppointment({ appointmentId: appt.id, newStart });
      if (!res.ok) {
        toast({ tone: "error", title: res.error });
        return;
      }
      setEvents((prev) => prev.map((ev) => (ev.id === appt.id ? { ...ev, startsAt: newStart, state: "scheduled" } : ev)));
      setConfirm(null);
      toast({ tone: "success", title: "Session moved", description: "No message was sent — that happens once messaging is set up." });
    });
  };

  return (
    <>
      {/* Desktop week grid */}
      <div className="hidden overflow-x-auto rounded-card border border-border lg:block">
        <div className="min-w-[760px]">
          {/* Header */}
          <div className="grid border-b border-border bg-surface-2" style={cols(days.length)}>
            <div className="px-2 py-2.5" />
            {days.map((d) => (
              <div key={d.date} className="px-2 py-2 text-center">
                <div className="text-[11px] font-medium uppercase tracking-wide text-text-3">{d.dow}</div>
                <div
                  className={cn(
                    "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums",
                    d.isToday ? "bg-accent text-accent-ink" : "text-text",
                  )}
                >
                  {d.day}
                </div>
              </div>
            ))}
          </div>

          {/* Hour rows */}
          {hours.map((hour) => (
            <div key={hour} className="grid border-b border-border last:border-0" style={cols(days.length)}>
              <div className="px-2 py-1 text-right text-[11px] tabular-nums text-text-3">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((d) => {
                const dh = dayHours(d.date);
                const open = dh && hour >= Number(dh.start.slice(0, 2)) && hour < Number(dh.end.slice(0, 2));
                const inBreak =
                  dh?.breaks?.some((b) => hour >= Number(b.start.slice(0, 2)) && hour < Number(b.end.slice(0, 2))) ?? false;
                const cell = cellEvents(d.date, hour);
                return (
                  <div
                    key={d.date}
                    onDragOver={(e) => open && !inBreak && e.preventDefault()}
                    onDrop={(e) => open && !inBreak && onDrop(d.date, hour, e)}
                    className={cn(
                      "min-h-[56px] space-y-1 border-l border-border p-1",
                      !open && "bg-surface-2/60",
                      inBreak && "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-surface-2)_6px,var(--color-surface-2)_12px)]",
                      d.isToday && open && "bg-accent-soft/20",
                    )}
                  >
                    {cell.map((ev) => (
                      <EventBlock key={ev.id} appt={ev} onOpen={() => router.push(`/app/sessions/${ev.id}`)} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile agenda */}
      <div className="space-y-5 lg:hidden">
        {days.map((d) => {
          const dayEvents = events
            .filter((ev) => ev.startsAt.startsWith(d.date))
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <div key={d.date}>
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("text-[13px] font-semibold", d.isToday ? "text-accent" : "text-text")}>
                  {d.dow} {d.day}
                </span>
                {d.isToday && <span className="text-[11px] text-accent">Today</span>}
              </div>
              {dayEvents.length === 0 ? (
                <p className="px-1 text-[12px] text-text-3">No sessions.</p>
              ) : (
                <div className="space-y-1.5">
                  {dayEvents.map((ev) => (
                    <EventBlock key={ev.id} appt={ev} onOpen={() => router.push(`/app/sessions/${ev.id}`)} mobile />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="px-1 text-[11.5px] text-text-3">Drag to reschedule on a larger screen.</p>
      </div>

      {/* Confirm reschedule */}
      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => !pending && setConfirm(null)}>
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-[660] text-text">Move this session?</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">
              {confirm.appt.clientName} — {confirm.appt.serviceName}
            </p>
            <div className="mt-3 rounded-control bg-surface-2 p-3 text-[13px]">
              <div className="text-text-3 line-through">{whenFull(confirm.appt.startsAt)}</div>
              <div className="mt-0.5 font-medium text-text">{whenFull(confirm.newStart)}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={doReschedule} loading={pending}>
                Move session
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EventBlock({ appt, onOpen, mobile = false }: { appt: AppointmentView; onOpen: () => void; mobile?: boolean }) {
  const movable = appt.state === "scheduled";
  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", appt.id)}
      onClick={onOpen}
      className={cn(
        "block w-full rounded-chip border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft/40",
        movable ? "cursor-grab active:cursor-grabbing" : "opacity-80",
        mobile && "rounded-card p-3",
      )}
    >
      <div className="flex items-center gap-1.5">
        <StatusDot tone={DOT[appt.state]} />
        <span className="text-[12px] font-semibold tabular-nums text-text">{hhmm(appt.startsAt)}</span>
        {appt.type === "online" && <Video className="size-3 text-info" strokeWidth={2} aria-hidden />}
      </div>
      <div className="mt-0.5 truncate text-[12px] text-text-2">{appt.clientName}</div>
      {mobile && <div className="text-[11px] text-text-3">{appt.serviceName} · {appt.roomName ?? (appt.type === "online" ? "Online" : "")}</div>}
    </button>
  );
}

function cols(n: number): React.CSSProperties {
  return { gridTemplateColumns: `48px repeat(${n}, minmax(0, 1fr))` };
}

function whenFull(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} · ${time}`;
}
