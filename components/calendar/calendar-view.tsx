"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Plus, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import type { BusinessHours } from "@/lib/mock/types";
import { isoWeekday } from "@/lib/mock/helpers";
import { rescheduleAppointment } from "@/app/app/calendar/actions";
import { CreateAppointmentModal, type CreateInitial, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { AppointmentDetail } from "@/components/calendar/appointment-detail";
import { Button } from "@/components/ui/button";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type View = "day" | "week" | "month" | "agenda";
const HOUR_PX = 52;
const START_HOUR = 7;
const END_HOUR = 19;

const DOT: Record<AppointmentState, DotTone> = {
  scheduled: "grey", completed: "green", no_show: "amber", cancelled: "grey",
  rescheduled: "grey", postponed: "amber", discharged: "green", risk_flagged: "rose",
};
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---- SAST date helpers (UTC-noon anchor, no DST) ---------------------- */
function ymdOf(d: Date): string { return d.toISOString().slice(0, 10); }
function parse(date: string): Date { return new Date(`${date}T12:00:00Z`); }
function addDays(date: string, n: number): string { const d = parse(date); d.setUTCDate(d.getUTCDate() + n); return ymdOf(d); }
function addMonths(date: string, n: number): string { const d = parse(date); d.setUTCMonth(d.getUTCMonth() + n); return ymdOf(d); }
function startOfWeek(date: string): string { return addDays(date, -(isoWeekday(date) - 1)); }
function startOfMonth(date: string): string { return `${date.slice(0, 7)}-01`; }
function minutesOf(iso: string): number { return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)); }
function hhmm(iso: string): string { return iso.slice(11, 16); }
function fmt(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", ...opts }).format(parse(date));
}

/** Room / counsellor double-booking check for a proposed new start (Phase 11 does this server-side). */
function findConflict(events: AppointmentView[], appt: AppointmentView, newStartISO: string): string | null {
  const start = new Date(newStartISO).getTime();
  const end = start + appt.durationMin * 60000;
  for (const e of events) {
    if (e.id === appt.id || e.state === "cancelled") continue;
    const es = new Date(e.startsAt).getTime();
    const ee = es + e.durationMin * 60000;
    if (start >= ee || end <= es) continue; // no overlap
    if (appt.roomId && e.roomId === appt.roomId) return `${appt.roomName ?? "That room"} is already booked then  pick another time or room.`;
    if (e.counsellorId === appt.counsellorId) return `${appt.counsellorName.split(" ")[0]} already has a session at that time.`;
  }
  return null;
}

export function CalendarView({
  events: initialEvents,
  businessHours,
  scheduling,
  nowISO,
  openSessions = true,
  clientBasePath = "/app/clients",
}: {
  events: AppointmentView[];
  businessHours: BusinessHours;
  scheduling: SchedulingOptions;
  nowISO: string;
  openSessions?: boolean;
  clientBasePath?: string;
}) {
  const { toast } = useToast();
  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowISO)), [nowISO]);
  const nowMin = useMemo(() => {
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(nowISO));
    const [h, m] = hm.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }, [nowISO]);

  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [events, setEvents] = useState(initialEvents);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInit, setCreateInit] = useState<CreateInitial | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [confirm, setConfirm] = useState<{ appt: AppointmentView; newStart: string } | null>(null);
  const [detail, setDetail] = useState<AppointmentView | null>(null);
  const [pending, setPending] = useState(false);

  const openCreate = (date?: string, time?: string) => {
    setCreateInit({ date: date ?? anchor, time, counsellorId: scheduling.defaultCounsellorId });
    setCreateKey((k) => k + 1);
    setCreateOpen(true);
  };

  const step = (dir: 1 | -1) => {
    if (view === "day" || view === "agenda") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => addMonths(a, dir));
  };

  const title = useMemo(() => {
    if (view === "day") return fmt(anchor, { weekday: "long", day: "numeric", month: "long" });
    if (view === "month") return fmt(anchor, { month: "long", year: "numeric" });
    const ws = startOfWeek(anchor);
    return `${fmt(ws, { day: "numeric", month: "short" })} – ${fmt(addDays(ws, 6), { day: "numeric", month: "short" })}`;
  }, [view, anchor]);

  const doReschedule = () => {
    if (!confirm) return;
    setPending(true);
    rescheduleAppointment({ appointmentId: confirm.appt.id, newStart: confirm.newStart }).then((res) => {
      setPending(false);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEvents((prev) => prev.map((e) => (e.id === confirm.appt.id ? { ...e, startsAt: confirm.newStart, state: "scheduled" } : e)));
      setConfirm(null);
      toast({ tone: "success", title: "Session moved", description: "No message was sent  that happens once messaging is set up." });
    });
  };

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <IconBtn label="Previous" onClick={() => step(-1)}><ChevronLeft className="size-4.5" aria-hidden /></IconBtn>
          <button type="button" onClick={() => setAnchor(today)} className="h-8 rounded-control border border-border px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text">Today</button>
          <IconBtn label="Next" onClick={() => step(1)}><ChevronRight className="size-4.5" aria-hidden /></IconBtn>
        </div>
        <h2 className="ml-1 text-[14.5px] font-[650] tracking-[-0.01em] text-text">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-control border border-border p-0.5">
            {(["day", "week", "month", "agenda"] as View[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cn("h-7 rounded-[6px] px-2.5 text-[12px] font-medium capitalize transition-colors", view === v ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}>{v}</button>
            ))}
          </div>
          <Button size="sm" onClick={() => openCreate()}><Plus className="size-4" strokeWidth={2.2} aria-hidden /> New</Button>
        </div>
      </div>

      {view === "month" ? (
        <MonthView anchor={anchor} today={today} events={events} onDay={(d) => { setAnchor(d); setView("day"); }} onCreate={(d) => openCreate(d)} onEvent={(e) => setDetail(e)} />
      ) : view === "agenda" ? (
        <AgendaView anchor={anchor} today={today} events={events} onEvent={(e) => setDetail(e)} />
      ) : (
        <TimeGrid
          dates={view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))}
          today={today}
          nowMin={nowMin}
          businessHours={businessHours}
          events={events}
          onCreate={openCreate}
          onEvent={(e) => setDetail(e)}
          onDrop={(appt, newStart) => newStart !== appt.startsAt && setConfirm({ appt, newStart })}
        />
      )}

      <CreateAppointmentModal key={createKey} open={createOpen} onClose={() => setCreateOpen(false)} options={scheduling} initial={createInit ?? undefined} />

      <AppointmentDetail
        key={detail?.id ?? "none"}
        appt={detail}
        onClose={() => setDetail(null)}
        onUpdated={(u) => { setEvents((prev) => prev.map((e) => (e.id === u.id ? u : e))); setDetail(u); }}
        conflictFor={(a, newStart) => findConflict(events, a, newStart)}
        openSessions={openSessions}
        clientBasePath={clientBasePath}
      />

      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => !pending && setConfirm(null)}>
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-[660] text-text">Move this session?</h3>
            <p className="mt-1.5 text-[13px] text-text-2">{confirm.appt.clientName}  {confirm.appt.serviceName}</p>
            <div className="mt-3 rounded-control bg-surface-2 p-3 text-[13px]">
              <div className="text-text-3 line-through">{whenFull(confirm.appt.startsAt)}</div>
              <div className="mt-0.5 font-medium text-text">{whenFull(confirm.newStart)}</div>
            </div>
            {(() => {
              const clash = findConflict(events, confirm.appt, confirm.newStart);
              return clash ? (
                <div className="mt-3 flex items-start gap-2 rounded-control border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden /> {clash}
                </div>
              ) : null;
            })()}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={pending}>Cancel</Button>
              <Button size="sm" onClick={doReschedule} loading={pending}>{findConflict(events, confirm.appt, confirm.newStart) ? "Move anyway" : "Move session"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Time grid (day / week) ------------------------------------------ */
function TimeGrid({ dates, today, nowMin, businessHours, events, onCreate, onEvent, onDrop }: {
  dates: string[]; today: string; nowMin: number; businessHours: BusinessHours;
  events: AppointmentView[]; onCreate: (d: string, t: string) => void; onEvent: (e: AppointmentView) => void; onDrop: (appt: AppointmentView, newStart: string) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const gridH = (END_HOUR - START_HOUR) * HOUR_PX;

  const clickToTime = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = START_HOUR * 60 + Math.floor((y / HOUR_PX) * 60 / 30) * 30;
    onCreate(date, `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[640px]">
        {/* Hour gutter */}
        <div className="w-12 shrink-0 pt-9">
          {hours.map((h) => (
            <div key={h} className="relative text-right" style={{ height: HOUR_PX }}>
              <span className="absolute -top-2 right-2 text-[10.5px] tabular-nums text-text-3">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
          {dates.map((date) => {
            const wd = isoWeekday(date);
            const bh = businessHours[wd];
            const isToday = date === today;
            const dayEvents = events.filter((e) => e.startsAt.startsWith(date));
            const laid = layout(dayEvents);
            return (
              <div key={date} className="border-l border-border first:border-l-0">
                {/* Day header */}
                <div className={cn("flex h-9 items-center justify-center gap-1.5 border-b border-border text-[12px]", isToday && "bg-accent-soft/30")}>
                  {dates.length > 1 && <span className={cn("font-medium uppercase", isToday ? "text-accent" : "text-text-3")}>{DOW[wd - 1]}</span>}
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full font-semibold tabular-nums", isToday ? "bg-accent text-accent-ink" : "text-text")}>{fmt(date, { day: "numeric" })}</span>
                </div>
                {/* Grid body */}
                <div className="relative" style={{ height: gridH }} onClick={(e) => clickToTime(e, date)}>
                  {/* hour lines + shading */}
                  {hours.map((h) => {
                    const open = bh && h >= Number(bh.start.slice(0, 2)) && h < Number(bh.end.slice(0, 2));
                    const inBreak = bh?.breaks?.some((b) => h >= Number(b.start.slice(0, 2)) && h < Number(b.end.slice(0, 2)));
                    return <div key={h} className={cn("border-b border-border/60", !open && "bg-surface-2/50", inBreak && "bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--color-surface-2)_5px,var(--color-surface-2)_10px)]", isToday && open && "bg-accent-soft/10")} style={{ height: HOUR_PX }} />;
                  })}
                  {/* now line */}
                  {isToday && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: ((nowMin - START_HOUR * 60) / 60) * HOUR_PX }}>
                      <span className="size-1.5 rounded-full bg-warn" /><span className="h-px flex-1 bg-warn/60" />
                    </div>
                  )}
                  {/* events */}
                  {laid.map(({ ev, col, cols }) => {
                    const top = ((minutesOf(ev.startsAt) - START_HOUR * 60) / 60) * HOUR_PX;
                    const height = Math.max(22, (ev.durationMin / 60) * HOUR_PX - 2);
                    const movable = ev.state === "scheduled";
                    return (
                      <button key={ev.id} type="button" draggable={movable}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", ev.id)}
                        onClick={(e) => { e.stopPropagation(); onEvent(ev); }}
                        className={cn("absolute z-10 overflow-hidden rounded-[7px] border px-1.5 py-1 text-left transition-shadow hover:z-30 hover:shadow-md", evTone(ev.state), movable && "cursor-grab active:cursor-grabbing")}
                        style={{ top, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                      >
                        <div className="flex items-center gap-1 text-[11px] font-semibold tabular-nums leading-tight">
                          <StatusDot tone={DOT[ev.state]} />{hhmm(ev.startsAt)}{ev.type === "online" && <Video className="size-2.5" strokeWidth={2.5} aria-hidden />}
                        </div>
                        <div className="truncate text-[11.5px] font-medium leading-tight">{ev.clientName}</div>
                        {height > 44 && <div className="truncate text-[10.5px] opacity-70">{ev.serviceName}</div>}
                      </button>
                    );
                  })}
                  {/* drop layer for reschedule */}
                  <DropLayer date={date} events={events} onDrop={onDrop} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DropLayer({ date, events, onDrop }: { date: string; events: AppointmentView[]; onDrop: (a: AppointmentView, s: string) => void }) {
  return (
    <div className="absolute inset-0 z-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const appt = events.find((x) => x.id === id);
        if (!appt) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mins = START_HOUR * 60 + Math.round(((e.clientY - rect.top) / HOUR_PX) * 60 / 15) * 15;
        const newStart = `${date}T${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00+02:00`;
        onDrop(appt, newStart);
      }}
    />
  );
}

/* ---- Month view ------------------------------------------------------- */
function MonthView({ anchor, today, events, onDay, onCreate, onEvent }: {
  anchor: string; today: string; events: AppointmentView[]; onDay: (d: string) => void; onCreate: (d: string) => void; onEvent: (e: AppointmentView) => void;
}) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = anchor.slice(0, 7);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border">
        {DOW.map((d) => <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase text-text-3">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === month;
          const isToday = date === today;
          const dayEvents = events.filter((e) => e.startsAt.startsWith(date)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <div key={date} className={cn("group min-h-[104px] border-b border-l border-border p-1.5 [&:nth-child(7n+1)]:border-l-0", !inMonth && "bg-surface-2/40")}>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => onDay(date)} className={cn("inline-flex size-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors hover:bg-surface-hover", isToday ? "bg-accent text-accent-ink" : inMonth ? "text-text" : "text-text-3")}>{fmt(date, { day: "numeric" })}</button>
                <button type="button" onClick={() => onCreate(date)} aria-label="New appointment" className="rounded p-0.5 opacity-0 transition-opacity hover:bg-surface-hover focus:opacity-100 group-hover:opacity-100"><Plus className="size-3.5 text-text-3" /></button>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button key={e.id} type="button" onClick={() => onEvent(e)} className={cn("flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10.5px] transition-colors", evTone(e.state))}>
                    <StatusDot tone={DOT[e.state]} /><span className="tabular-nums">{hhmm(e.startsAt)}</span><span className="truncate">{e.clientName}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && <button type="button" onClick={() => onDay(date)} className="px-1 text-[10.5px] font-medium text-text-3 hover:text-text">+{dayEvents.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Agenda view ------------------------------------------------------ */
function AgendaView({ anchor, today, events, onEvent }: { anchor: string; today: string; events: AppointmentView[]; onEvent: (e: AppointmentView) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(anchor, i));
  const has = days.some((d) => events.some((e) => e.startsAt.startsWith(d)));
  if (!has) return <div className="p-2"><EmptyState icon={CalendarDays} title="Nothing scheduled" body="The next two weeks are clear from here." /></div>;
  return (
    <div className="divide-y divide-border">
      {days.map((date) => {
        const dayEvents = events.filter((e) => e.startsAt.startsWith(date)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        if (dayEvents.length === 0) return null;
        return (
          <div key={date} className="flex gap-4 px-4 py-3">
            <div className="w-16 shrink-0 pt-0.5">
              <div className={cn("text-[12px] font-semibold uppercase", date === today ? "text-accent" : "text-text-3")}>{fmt(date, { weekday: "short" })}</div>
              <div className="text-[18px] font-bold tabular-nums text-text">{fmt(date, { day: "numeric" })}</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {dayEvents.map((e) => (
                <button key={e.id} type="button" onClick={() => onEvent(e)} className="flex w-full items-center gap-3 rounded-control border border-border p-2.5 text-left transition-colors hover:bg-surface-hover">
                  <span className="w-12 shrink-0 text-[12px] font-semibold tabular-nums text-text-2">{hhmm(e.startsAt)}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-text"><StatusDot tone={DOT[e.state]} />{e.clientName}</span>
                  <span className="ml-auto text-[11.5px] text-text-3">{e.serviceName} · {e.roomName ?? (e.type === "online" ? "Online" : "")}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- shared ----------------------------------------------------------- */
function evTone(state: AppointmentState): string {
  if (state === "risk_flagged") return "border-danger/30 bg-danger-soft text-danger";
  if (state === "completed" || state === "discharged") return "border-accent/30 bg-accent-soft text-accent";
  if (state === "no_show" || state === "postponed") return "border-warn/30 bg-warn-soft text-warn";
  return "border-border bg-surface text-text hover:border-accent/40";
}

function layout(dayEvents: AppointmentView[]): { ev: AppointmentView; col: number; cols: number }[] {
  const evs = dayEvents.map((e) => ({ e, s: minutesOf(e.startsAt), end: minutesOf(e.startsAt) + e.durationMin })).sort((a, b) => a.s - b.s || a.end - b.end);
  const colEnds: number[] = [];
  const colOf = new Map<string, number>();
  for (const x of evs) {
    let c = colEnds.findIndex((end) => end <= x.s);
    if (c === -1) { c = colEnds.length; colEnds.push(x.end); } else colEnds[c] = x.end;
    colOf.set(x.e.id, c);
  }
  return evs.map((x) => {
    const concurrent = evs.filter((o) => o.s < x.end && o.end > x.s).length;
    return { ev: x.e, col: colOf.get(x.e.id) ?? 0, cols: Math.max(concurrent, (colOf.get(x.e.id) ?? 0) + 1) };
  });
}

function whenFull(iso: string): string {
  const d = new Date(iso);
  return `${new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(d)} · ${new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(d)}`;
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={label} className="inline-flex size-8 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text">{children}</button>;
}
