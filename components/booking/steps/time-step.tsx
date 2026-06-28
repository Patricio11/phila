"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarX2, Loader2 } from "lucide-react";
import type { BusinessHours } from "@/lib/domain/types";
import { isoWeekday } from "@/lib/domain/helpers";
import { getAvailableSlots, type SlotOption } from "@/app/o/[slug]/book/actions";
import { StepHeader } from "@/components/booking/step-header";
import { cn } from "@/lib/utils";

/** Build the next open business days from today (SAST), honouring closed days. */
function upcomingOpenDays(businessHours: BusinessHours, count: number): string[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const days: string[] = [];
  for (let i = 0; i < 30 && days.length < count; i++) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    if (businessHours[isoWeekday(date)]) days.push(date);
  }
  return days;
}

function formatDayChip(date: string): { dow: string; day: string; month: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    dow: new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "short" }).format(d),
  };
}

export function TimeStep({
  slug,
  businessHours,
  durationMin,
  counsellorId,
  date,
  slotStart,
  onPickDate,
  onPickSlot,
}: {
  slug: string;
  businessHours: BusinessHours;
  durationMin: number;
  counsellorId: string | null;
  date: string | null;
  slotStart: string | null;
  onPickDate: (date: string) => void;
  onPickSlot: (start: string, counsellorId: string) => void;
}) {
  const [days] = useState(() => upcomingOpenDays(businessHours, 10));
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeDate = date ?? days[0] ?? null;

  useEffect(() => {
    if (!activeDate) return;
    startTransition(async () => {
      setError(null);
      const res = await getAvailableSlots({ slug, counsellorId, date: activeDate, durationMin });
      if (res.ok) setSlots(res.slots);
      else {
        setSlots([]);
        setError(res.error);
      }
    });
  }, [slug, counsellorId, activeDate, durationMin]);

  return (
    <div>
      <StepHeader title="Pick a time" subtitle="Times shown honour the practice's hours and breaks." />

      {/* Day chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const c = formatDayChip(d);
          const selected = activeDate === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDate(d)}
              aria-pressed={selected}
              className={cn(
                "flex min-w-[64px] shrink-0 flex-col items-center rounded-control border px-3 py-2 transition-colors",
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-text-2 hover:bg-surface-hover",
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide">{c.dow}</span>
              <span className="text-[18px] font-bold tabular-nums leading-tight">{c.day}</span>
              <span className="text-[10.5px] text-text-3">{c.month}</span>
            </button>
          );
        })}
      </div>

      {/* Slots */}
      <div className="mt-6 min-h-[120px]">
        {pending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-text-3">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Finding open times…
          </div>
        ) : error ? (
          <p className="py-8 text-center text-[13px] text-danger">{error}</p>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CalendarX2 className="size-7 text-text-3" strokeWidth={1.8} aria-hidden />
            <p className="mt-2 text-[13.5px] font-medium text-text">No open times on this day</p>
            <p className="mt-1 text-[12.5px] text-text-2">Try another day  the calendar fills up fast.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => {
              const selected = slotStart === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onPickSlot(s.start, s.counsellorId)}
                  aria-pressed={selected}
                  className={cn(
                    "h-11 rounded-control border text-[14px] font-medium tabular-nums transition-colors",
                    selected
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border bg-surface text-text hover:border-accent/50 hover:bg-accent-soft/40",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
