import Link from "next/link";
import { isRemote } from "@/lib/domain/enums";
import { notFound } from "next/navigation";
import { Accessibility, ArrowRight, Building2, CircleDot, DoorOpen, Gauge, Video, Wrench } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider, type RoomView } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/domain/types";
import { isoWeekday } from "@/lib/domain/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { StatCard } from "@/components/ui/stat-card";
import { CreateRoomButton } from "@/components/rooms/room-buttons";
import { ManageSitesButton } from "@/components/rooms/manage-sites-button";
import { cn } from "@/lib/utils";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rooms" };

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toMin(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}
function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function sastToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Open minutes on a date (business hours minus breaks). */
function openMinutes(date: string, bh: BusinessHours): number {
  const h = bh[isoWeekday(date)];
  if (!h) return 0;
  const breaks = (h.breaks ?? []).reduce((s, b) => s + (toMin(b.end) - toMin(b.start)), 0);
  return Math.max(0, toMin(h.end) - toMin(h.start) - breaks);
}

/** Live occupancy from the week's bookings - who is in the room right now, and what's next. */
function liveOf(bookings: AppointmentView[], nowMs: number): {
  busy: { counsellorName: string; clientName: string; untilMs: number } | null;
  next: AppointmentView | null;
} {
  const active = bookings.filter((b) => b.state !== "cancelled");
  const current = active.find((b) => {
    const s = new Date(b.startsAt).getTime();
    return s <= nowMs && s + b.durationMin * 60_000 > nowMs;
  });
  const next = active.filter((b) => new Date(b.startsAt).getTime() > nowMs).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  return {
    busy: current ? { counsellorName: current.counsellorName, clientName: current.clientName, untilMs: new Date(current.startsAt).getTime() + current.durationMin * 60_000 } : null,
    next,
  };
}

function hhmmOf(ms: number): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

/** "in 40 min" / "in 2h 15m" / "Tomorrow 09:00" - the human next-up label. */
function relativeLabel(iso: string, nowMs: number, today: string): string {
  const t = new Date(iso).getTime();
  const mins = Math.round((t - nowMs) / 60_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  if (day === today) {
    if (mins < 60) return `in ${Math.max(1, mins)} min`;
    return `in ${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ""}`.trim();
  }
  const dow = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(new Date(iso));
  return `${dow} ${hhmmOf(t)}`;
}

interface DayCell {
  date: string;
  dow: string;
  pct: number;
  isToday: boolean;
  open: boolean;
}

export default async function HubRoomsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [rooms, org, sites] = await Promise.all([
    provider.getRoomsOverview(membership.orgId, now),
    provider.getOrg(membership.orgId),
    provider.listSites(membership.orgId),
  ]);
  if (rooms.length === 0 || !org) notFound();

  const bh = org.scheduling.businessHours;
  const today = sastToday();
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => bh[isoWeekday(d)]);

  // Per-room per-day occupancy (the weekly rhythm).
  const perDayByRoom = new Map<string, DayCell[]>();
  for (const rv of rooms) {
    const cells: DayCell[] = weekDates.map((date) => {
      const open = openMinutes(date, bh);
      const booked = rv.bookings.filter((b) => b.startsAt.startsWith(date)).reduce((s, b) => s + b.durationMin, 0);
      return {
        date,
        dow: DOW[isoWeekday(date)] ?? "",
        pct: open === 0 ? 0 : Math.min(100, Math.round((booked / open) * 100)),
        isToday: date === today,
        open: open > 0,
      };
    });
    perDayByRoom.set(rv.room.id, cells);
  }

  // Site grouping + summary.
  const bySite = new Map<string, RoomView[]>();
  for (const r of rooms) {
    const arr = bySite.get(r.siteName) ?? [];
    arr.push(r);
    bySite.set(r.siteName, arr);
  }
  const active = rooms.filter((r) => r.room.status === "active");
  const avgUtil = active.length === 0 ? 0 : Math.round(active.reduce((s, r) => s + r.utilisation.utilisationPct, 0) / active.length);
  const inMaintenance = rooms.filter((r) => r.room.status === "maintenance").length;

  // Live occupancy - the "right now" truth per room (feedback #8).
  const nowMs = new Date(now).getTime();
  const liveByRoom = new Map(rooms.map((rv) => [rv.room.id, liveOf(rv.bookings, nowMs)]));
  const busyCount = active.filter((rv) => liveByRoom.get(rv.room.id)?.busy).length;

  // Rooms-per-site, so the site manager can stop you removing a site that's in use.
  const roomCounts: Record<string, number> = {};
  for (const r of rooms) roomCounts[r.room.siteId] = (roomCounts[r.room.siteId] ?? 0) + 1;

  return (
    <div className="rise space-y-7">
      <PageHead
        title="Rooms & resources"
        summary="Every room's weekly rhythm and how well it's used  across all your sites."
        actions={
          <div className="flex items-center gap-2">
            <ManageSitesButton sites={sites.map((s) => ({ id: s.id, name: s.name, province: s.province }))} roomCounts={roomCounts} />
            <CreateRoomButton sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
          </div>
        }
      />

      {/* Summary band */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Summary icon={DoorOpen} value={String(rooms.length)} label="Rooms" />
        <Summary icon={Building2} value={String(bySite.size)} label="Sites" />
        <Summary icon={Gauge} value={`${avgUtil}%`} label="Avg utilisation" />
        <Summary icon={Wrench} value={String(inMaintenance)} label="In maintenance" tone={inMaintenance > 0 ? "warn" : "default"} />
      </div>

      {/* Right now - live pulse across every active room (feedback #8) */}
      <section className="rounded-card border border-border bg-surface p-4 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text">Right now</h2>
          <span className="text-[12px] text-text-2">
            <span className="font-semibold tabular-nums text-text">{busyCount}</span> of {active.length} room{active.length === 1 ? "" : "s"} in use
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {active.map((rv) => {
            const live = liveByRoom.get(rv.room.id);
            const busy = live?.busy ?? null;
            return (
              <Link
                key={rv.room.id}
                href={`/hub/rooms/${rv.room.id}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-chip border px-2.5 py-1.5 text-[12px] transition-colors",
                  busy ? "border-accent/40 bg-accent-soft/40" : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <span className="relative flex size-2" aria-hidden>
                  {busy && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />}
                  <span className={cn("relative inline-flex size-2 rounded-full", busy ? "bg-accent" : "bg-border-strong")} />
                </span>
                <span className="font-medium text-text">{rv.room.name}</span>
                <span className="text-text-3">
                  {busy
                    ? `${busy.counsellorName.split(" ")[0]} · until ${hhmmOf(busy.untilMs)}`
                    : live?.next
                      ? `free · next ${relativeLabel(live.next.startsAt, nowMs, today)}`
                      : "free today"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {[...bySite.entries()].map(([site, siteRooms]) => (
        <section key={site}>
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text-3">
            <Building2 className="size-4" strokeWidth={2} aria-hidden /> {site}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {siteRooms.map((rv) => (
              <RoomCard key={rv.room.id} rv={rv} days={perDayByRoom.get(rv.room.id) ?? []} live={liveByRoom.get(rv.room.id) ?? { busy: null, next: null }} nowMs={nowMs} today={today} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function insight(rv: RoomView): { label: string; tone: "warn" | "accent" | "info" | "neutral" } {
  if (rv.room.status === "maintenance") return { label: "In maintenance", tone: "neutral" };
  const u = rv.utilisation.utilisationPct;
  if (u >= 80) return { label: "Near capacity", tone: "warn" };
  if (u >= 40) return { label: "Healthy use", tone: "accent" };
  if (u > 0) return { label: "Room to spare", tone: "info" };
  return { label: "Idle this week", tone: "neutral" };
}

function RoomCard({ rv, days, live, nowMs, today }: {
  rv: RoomView;
  days: DayCell[];
  live: { busy: { counsellorName: string; clientName: string; untilMs: number } | null; next: AppointmentView | null };
  nowMs: number;
  today: string;
}) {
  const { room, utilisation, assignments, bookings } = rv;
  const tip = insight(rv);
  const upcoming = bookings.filter((b) => b.state !== "cancelled" && new Date(b.startsAt).getTime() > nowMs).slice(0, 3);
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <Link href={`/hub/rooms/${room.id}`} className="flex items-center gap-2.5 border-b border-border px-4 py-3 transition-colors hover:bg-surface-hover">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: room.colour }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-[640] text-text">{room.name}</div>
          <div className="text-[11.5px] text-text-3">Capacity {room.capacity}</div>
        </div>
        {live.busy ? (
          <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent-soft px-2 py-1 text-[11.5px] font-semibold text-accent">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-accent" />
            </span>
            In use · {live.busy.counsellorName.split(" ")[0]} · until {hhmmOf(live.busy.untilMs)}
          </span>
        ) : (
          <Tag tone={tip.tone}>{tip.label}</Tag>
        )}
      </Link>

      <div className="space-y-4 p-4">
        {room.equipment.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {room.equipment.map((e) => (
              <Tag key={e} tone="neutral">
                {e.includes("wheelchair") ? <Accessibility className="size-3" strokeWidth={2} aria-hidden /> : <CircleDot className="size-3" strokeWidth={2} aria-hidden />}
                {e}
              </Tag>
            ))}
          </div>
        )}

        {/* Weekly rhythm  per-day occupancy bars */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">This week</h3>
            <span className="text-[11.5px] text-text-3">
              {utilisation.bookedHours}h booked · {utilisation.meetings} sessions
            </span>
          </div>
          <div className="flex items-end gap-2">
            {days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end overflow-hidden rounded-[6px] bg-surface-2">
                  <div
                    className="w-full rounded-[6px] transition-all"
                    style={{ height: `${Math.max(d.pct, d.pct > 0 ? 8 : 0)}%`, backgroundColor: room.colour, opacity: d.isToday ? 1 : 0.55 }}
                    title={`${d.dow}: ${d.pct}%`}
                  />
                </div>
                <span className={cn("text-[10.5px] tabular-nums", d.isToday ? "font-semibold text-text" : "text-text-3")}>{d.dow}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assignments */}
        <div>
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Assigned counsellors</h3>
          {assignments.length === 0 ? (
            <p className="text-[12.5px] text-text-3">No recurring assignment.</p>
          ) : (
            <ul className="space-y-1">
              {assignments.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-[12.5px] text-text-2">
                  <Avatar name={a.counsellorName} size="sm" />
                  <span className="font-medium text-text">{a.counsellorName}</span>
                  <span className="text-text-3">
                    {a.days.map((d) => DOW[d]).join(" & ")} · {a.start}–{a.end}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Next up - relative and human (feedback #8) */}
        <div>
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Next up</h3>
          {upcoming.length === 0 ? (
            <p className="text-[12.5px] text-text-3">Quiet for the rest of the week.</p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-[12px]">
                  <span className="w-20 shrink-0 rounded-chip bg-surface-2 px-1.5 py-0.5 text-center font-medium tabular-nums text-text-2">{relativeLabel(b.startsAt, nowMs, today)}</span>
                  <span className="w-11 shrink-0 tabular-nums text-text-3">{timeOf(b.startsAt).slice(-5)}</span>
                  <span className="min-w-0 flex-1 truncate text-text-2">{b.clientName}</span>
                  <span className="shrink-0 text-text-3">{b.counsellorName.split(" ")[0]}</span>
                  {isRemote(b.type) && <Video className="size-3 text-info" strokeWidth={2} aria-hidden />}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link href={`/hub/rooms/${room.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
          Open room & schedule <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function Summary({
  icon: Icon,
  value,
  label,
  tone = "default",
}: {
  icon: typeof DoorOpen;
  value: string;
  label: string;
  tone?: "default" | "warn";
}) {
  return <StatCard icon={Icon} value={value} label={label} tone={tone} />;
}
