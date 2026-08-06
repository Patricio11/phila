"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import type { BusinessHours } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { useToast } from "@/components/ui/toast";
import { saveMemberAvailability } from "@/app/hub/team/actions";
import { cn } from "@/lib/utils";

type DayNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;
interface Window { weekday: number; start: string; end: string }

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

/**
 * Feedback #5 - a counsellor's weekly availability, edited by the ORG only.
 * No custom pattern = the counsellor follows the practice working hours; a
 * saved pattern narrows when they can be booked (hub modal + public page).
 */
export function AvailabilityEditor({ counsellorId, firstName, initial, orgHours }: {
  counsellorId: string;
  firstName: string;
  initial: Window[];
  orgHours: BusinessHours;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState(initial.length > 0);
  const [days, setDays] = useState<Record<DayNum, { start: string; end: string } | null>>(() => {
    const out = {} as Record<DayNum, { start: string; end: string } | null>;
    for (const { n } of DAYS) {
      const w = initial.find((x) => x.weekday === n);
      // Editing starts from the saved pattern, else seeded from the org's hours.
      const seed = orgHours[n];
      out[n] = w ? { start: w.start, end: w.end } : initial.length > 0 ? null : seed ? { start: seed.start, end: seed.end } : null;
    }
    return out;
  });

  const toggleDay = (n: DayNum) =>
    setDays((prev) => ({ ...prev, [n]: prev[n] ? null : { start: orgHours[n]?.start ?? "08:00", end: orgHours[n]?.end ?? "17:00" } }));
  const setTime = (n: DayNum, field: "start" | "end", value: string) =>
    setDays((prev) => ({ ...prev, [n]: prev[n] ? { ...prev[n]!, [field]: value } : prev[n] }));

  const invalid = DAYS.some(({ n }) => { const d = days[n]; return d && d.end <= d.start; });

  const save = (windows: Window[]) =>
    start(async () => {
      const res = await saveMemberAvailability({ counsellorId, windows });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setCustom(windows.length > 0);
      toast({
        tone: "success",
        title: "Availability saved",
        description: windows.length > 0
          ? `Bookings for ${firstName} now only offer these times.`
          : `${firstName} follows the practice working hours again.`,
      });
    });

  const saveCustom = () => {
    if (invalid) return toast({ tone: "error", title: "Each window must end after it starts." });
    const windows = DAYS.flatMap(({ n }) => (days[n] ? [{ weekday: n, start: days[n]!.start, end: days[n]!.end }] : []));
    save(windows);
  };

  if (!custom) {
    return (
      <div className="px-[17px] pb-[17px]">
        <p className="text-[12.5px] leading-relaxed text-text-2">
          {firstName} follows the practice working hours. Set a custom pattern to limit when they can be booked.
        </p>
        <div className="mt-3">
          <Button size="sm" variant="subtle" onClick={() => setCustom(true)}>
            <CalendarClock className="size-3.5" strokeWidth={2} aria-hidden /> Set availability
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-[17px] pb-[17px]">
      <ul className="space-y-1.5">
        {DAYS.map(({ n, label }) => {
          const d = days[n];
          const on = Boolean(d);
          const bad = d ? d.end <= d.start : false;
          return (
            <li key={n} className="flex items-center gap-2.5">
              <Toggle on={on} onClick={() => toggleDay(n)} />
              <span className={cn("w-[4.5rem] shrink-0 text-[12.5px]", on ? "text-text" : "text-text-3")}>{label}</span>
              {on ? (
                <div className="flex items-center gap-1">
                  <TimePicker compact minuteStep={15} className="w-[5.5rem]" value={d!.start} onChange={(v) => setTime(n, "start", v)} invalid={bad} ariaLabel={`${label} from`} />
                  <span className="text-text-3">–</span>
                  <TimePicker compact minuteStep={15} className="w-[5.5rem]" value={d!.end} onChange={(v) => setTime(n, "end", v)} invalid={bad} ariaLabel={`${label} until`} />
                </div>
              ) : (
                <span className="text-[12px] text-text-3">Off</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3.5 flex items-center gap-2">
        <Button size="sm" onClick={saveCustom} loading={pending} disabled={invalid}>Save availability</Button>
        <Button size="sm" variant="ghost" onClick={() => save([])} disabled={pending}>Use practice hours</Button>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-text-3">Only practice admins can change availability - changes appear on the activity feed.</p>
    </div>
  );
}
