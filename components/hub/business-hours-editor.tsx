"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import type { BusinessHours } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveBusinessHours } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

type DayNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type DayHours = { start: string; end: string } | null;

const DAYS: { n: DayNum; label: string }[] = [
  { n: 1, label: "Monday" }, { n: 2, label: "Tuesday" }, { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" }, { n: 5, label: "Friday" }, { n: 6, label: "Saturday" }, { n: 7, label: "Sunday" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

export function BusinessHoursEditor({ initial }: { initial: BusinessHours }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [hours, setHours] = useState<Record<DayNum, DayHours>>(() => {
    const out = {} as Record<DayNum, DayHours>;
    for (const { n } of DAYS) {
      const h = initial[n];
      out[n] = h ? { start: h.start, end: h.end } : null;
    }
    return out;
  });

  const toggleDay = (n: DayNum) =>
    setHours((prev) => ({ ...prev, [n]: prev[n] ? null : { start: "08:00", end: "17:00" } }));
  const setTime = (n: DayNum, field: "start" | "end", value: string) =>
    setHours((prev) => ({ ...prev, [n]: prev[n] ? { ...prev[n]!, [field]: value } : prev[n] }));

  const invalid = DAYS.some(({ n }) => { const h = hours[n]; return h && h.end <= h.start; });

  const save = () => {
    if (invalid) return toast({ tone: "error", title: "Each day's end time must be after its start." });
    start(async () => {
      const res = await saveBusinessHours({ hours });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Working hours saved", description: "Closed days and times are blocked across the calendar." });
    });
  };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">
        <Clock className="size-3.5" strokeWidth={2} aria-hidden /> Working hours
      </h3>
      <ul className="space-y-1.5">
        {DAYS.map(({ n, label }) => {
          const h = hours[n];
          const open = Boolean(h);
          const bad = h ? h.end <= h.start : false;
          return (
            <li key={n} className="flex items-center gap-3">
              <Toggle on={open} onClick={() => toggleDay(n)} />
              <span className={cn("w-20 shrink-0 text-[13px]", open ? "text-text" : "text-text-3")}>{label}</span>
              {open ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={h!.start}
                    onChange={(e) => setTime(n, "start", e.target.value)}
                    className={cn("h-8 rounded-control border bg-surface px-2 text-[12.5px] tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", bad ? "border-danger" : "border-border")}
                  />
                  <span className="text-text-3">–</span>
                  <input
                    type="time"
                    value={h!.end}
                    onChange={(e) => setTime(n, "end", e.target.value)}
                    className={cn("h-8 rounded-control border bg-surface px-2 text-[12.5px] tabular-nums text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", bad ? "border-danger" : "border-border")}
                  />
                </div>
              ) : (
                <span className="text-[12.5px] text-text-3">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3.5">
        <Button size="sm" onClick={save} loading={pending} disabled={invalid}>Save working hours</Button>
      </div>
    </div>
  );
}
