"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, MapPin, Video, CalendarRange } from "lucide-react";
import type { BusinessHours } from "@/lib/domain/types";
import type { AvailabilityMode } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { useToast } from "@/components/ui/toast";
import { saveMemberAvailability } from "@/app/hub/team/actions";
import { cn } from "@/lib/utils";

type DayNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface Window { weekday: number; start: string; end: string; mode: AvailabilityMode }

const DAYS: { n: DayNum; label: string }[] = [
  { n: 1, label: "Monday" }, { n: 2, label: "Tuesday" }, { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" }, { n: 5, label: "Friday" }, { n: 6, label: "Saturday" }, { n: 7, label: "Sunday" },
];

/**
 * Batch 3r - In person and Online lead; "Any session" is an explicit opt-in.
 * The old editor seeded a full-week any-session pattern from practice hours
 * and saved it silently, so a counsellor who only set in-person mornings
 * still looked bookable everywhere. Now the base pattern exists only when
 * its toggle is ON - and switching it on visibly copies the practice hours
 * in, ready to trim.
 */
const MODES: { key: AvailabilityMode; label: string; icon: typeof MapPin; blurb: string }[] = [
  { key: "in_person", label: "In person", icon: MapPin, blurb: "Hours for room sessions. Hybrid counts as in person (they hold a room)." },
  { key: "online", label: "Online", icon: Video, blurb: "Hours for video sessions only - no room needed." },
  { key: "both", label: "Any session", icon: CalendarRange, blurb: "The base pattern - these hours can hold any kind of session. Started from the practice hours; trim as needed." },
];

type Grid = Record<AvailabilityMode, Record<DayNum, { start: string; end: string } | null>>;

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

/**
 * A counsellor's weekly availability. The ORG edits any member's here; the
 * counsellor edits their OWN from Settings (pass `save`), which notifies the
 * practice and lands on the activity feed.
 *
 * Batch 2n - availability is per session type. "Any session" is the base
 * pattern; **In person** and **Online** add hours that only that kind of
 * session can use, so booking offers the right people: a video-only evening
 * never answers a room booking, and a room-only morning never answers a video
 * one. No pattern at all = the practice working hours, as before.
 */
export function AvailabilityEditor({ counsellorId, firstName, initial, orgHours, save: saveFn, note }: {
  counsellorId: string;
  firstName: string;
  initial: Window[];
  orgHours: BusinessHours;
  /** Own-availability save (Settings). Omitted = the org action. */
  save?: (windows: Window[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  note?: string;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState(initial.length > 0);
  const [mode, setMode] = useState<AvailabilityMode>("in_person");
  // The any-session base pattern is opt-in: on only when saved windows say so.
  const [anyOn, setAnyOn] = useState(initial.some((w) => w.mode === "both"));
  const [grid, setGrid] = useState<Grid>(() => {
    const out = {} as Grid;
    for (const m of MODES) {
      const days = {} as Record<DayNum, { start: string; end: string } | null>;
      for (const { n } of DAYS) {
        const w = initial.find((x) => x.weekday === n && x.mode === m.key);
        days[n] = w ? { start: w.start, end: w.end } : null;
      }
      out[m.key] = days;
    }
    return out;
  });

  // Switching the base pattern ON copies the practice hours in (visible,
  // editable); switching it OFF steps the editor back to In person.
  const toggleAny = () => {
    if (anyOn) {
      setAnyOn(false);
      if (mode === "both") setMode("in_person");
      return;
    }
    setAnyOn(true);
    setGrid((prev) => {
      const empty = DAYS.every(({ n }) => !prev.both[n]);
      if (!empty) return prev;
      const seeded = {} as Record<DayNum, { start: string; end: string } | null>;
      for (const { n } of DAYS) {
        const h = orgHours[n];
        seeded[n] = h ? { start: h.start, end: h.end } : null;
      }
      return { ...prev, both: seeded };
    });
    setMode("both");
  };

  const counts = useMemo(() => {
    const out = {} as Record<AvailabilityMode, number>;
    for (const m of MODES) out[m.key] = DAYS.filter(({ n }) => grid[m.key][n]).length;
    return out;
  }, [grid]);

  const days = grid[mode];
  const toggleDay = (n: DayNum) =>
    setGrid((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], [n]: prev[mode][n] ? null : { start: orgHours[n]?.start ?? "08:00", end: orgHours[n]?.end ?? "17:00" } },
    }));
  const setTime = (n: DayNum, field: "start" | "end", value: string) =>
    setGrid((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], [n]: prev[mode][n] ? { ...prev[mode][n]!, [field]: value } : prev[mode][n] },
    }));

  const invalid = MODES.filter(({ key }) => key !== "both" || anyOn)
    .some(({ key }) => DAYS.some(({ n }) => { const d = grid[key][n]; return d && d.end <= d.start; }));
  const total = (anyOn ? counts.both : 0) + counts.in_person + counts.online;

  const persist = (windows: Window[]) =>
    start(async () => {
      const res = saveFn ? await saveFn(windows) : await saveMemberAvailability({ counsellorId, windows });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setCustom(windows.length > 0);
      const perMode = windows.length > 0
        ? [
            windows.some((w) => w.mode === "in_person") ? "in person" : null,
            windows.some((w) => w.mode === "online") ? "online" : null,
          ].filter(Boolean).join(" and ")
        : "";
      toast({
        tone: "success",
        title: "Availability saved",
        description: windows.length > 0
          ? `Bookings for ${firstName} now only offer these times${perMode ? `, split by ${perMode}` : ""}.`
          : `${firstName} follows the practice working hours again.`,
      });
    });

  const saveCustom = () => {
    if (invalid) return toast({ tone: "error", title: "Each window must end after it starts." });
    // The base pattern only travels when its toggle is on.
    const windows = MODES.filter(({ key }) => key !== "both" || anyOn).flatMap(({ key }) =>
      DAYS.flatMap(({ n }) => (grid[key][n] ? [{ weekday: n, start: grid[key][n]!.start, end: grid[key][n]!.end, mode: key }] : [])),
    );
    persist(windows);
  };

  if (!custom) {
    return (
      <div className="px-[17px] pb-[17px]">
        <p className="text-[12.5px] leading-relaxed text-text-2">
          {firstName} follows the practice working hours. Set a pattern to limit when they can be booked, and to say which hours are for room sessions and which are for video.
        </p>
        <div className="mt-3">
          <Button size="sm" variant="subtle" onClick={() => setCustom(true)}>
            <CalendarClock className="size-3.5" strokeWidth={2} aria-hidden /> Set availability
          </Button>
        </div>
      </div>
    );
  }

  const active = MODES.find((m) => m.key === mode)!;

  return (
    <div className="px-[17px] pb-[17px]">
      {/* Which kind of session are we setting hours for? The base pattern's
          chip only exists while its toggle (below) is on. */}
      <div className="flex flex-wrap gap-1.5">
        {MODES.filter(({ key }) => key !== "both" || anyOn).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
            className={cn(
              "inline-flex h-[28px] items-center gap-1.5 rounded-chip border px-2.5 text-[12px] font-medium transition-colors",
              mode === key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            {label}
            <span className="tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-text-3">{active.blurb}</p>

      {/* The any-session base pattern: an explicit choice, never a silent default. */}
      <div className="mt-3 flex items-start justify-between gap-3 rounded-card border border-border bg-surface-2/40 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <CalendarRange className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
          <div>
            <div className="text-[12.5px] font-medium text-text">Any-session base pattern</div>
            <p className="text-[11.5px] leading-relaxed text-text-3">
              {anyOn
                ? "On - these base hours can hold any kind of session, on top of the in-person and online hours."
                : "Off - only the in-person and online hours above count. Switch on to start from the practice hours and trim."}
            </p>
          </div>
        </div>
        <span className="mt-0.5"><Toggle on={anyOn} onClick={toggleAny} label="Any-session base pattern" /></span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {DAYS.map(({ n, label }) => {
          const d = days[n];
          const on = Boolean(d);
          const bad = d ? d.end <= d.start : false;
          return (
            // Wraps in narrow cards: the time pair drops to its own right-aligned
            // line instead of squeezing against the edge (batch 3r polish).
            <li key={n} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Toggle on={on} onClick={() => toggleDay(n)} label={`${label} ${active.label}`} />
              <span className={cn("w-[4.5rem] shrink-0 text-[12.5px]", on ? "text-text" : "text-text-3")}>{label}</span>
              {on ? (
                <div className="ml-auto flex items-center gap-1">
                  <TimePicker compact minuteStep={15} className="w-[5.5rem]" value={d!.start} onChange={(v) => setTime(n, "start", v)} invalid={bad} ariaLabel={`${label} ${active.label} from`} />
                  <span className="text-text-3">-</span>
                  <TimePicker compact minuteStep={15} className="w-[5.5rem]" value={d!.end} onChange={(v) => setTime(n, "end", v)} invalid={bad} ariaLabel={`${label} ${active.label} until`} />
                </div>
              ) : (
                <span className="ml-auto text-[12px] text-text-3">Off</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3.5 flex items-center gap-2">
        <Button size="sm" onClick={saveCustom} loading={pending} disabled={invalid || total === 0}>Save availability</Button>
        <Button size="sm" variant="ghost" onClick={() => persist([])} disabled={pending}>Use practice hours</Button>
      </div>
      {total === 0 && <p className="mt-2 text-[11.5px] text-warn">Every day is off. Save nothing, or use practice hours instead.</p>}
      <p className="mt-2 text-[11.5px] leading-relaxed text-text-3">
        {note ?? "Changes appear on the activity feed. Booking only offers a counsellor when the whole session fits a window that allows that session type."}
      </p>
    </div>
  );
}
