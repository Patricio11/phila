import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, DoorOpen, Gauge, MapPin } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Tag } from "@/components/ui/tag";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { EditRoomButton } from "@/components/rooms/room-buttons";
import { AssignCounsellorButton } from "@/components/rooms/assign-counsellor";
import { RoomScheduleGrid } from "@/components/rooms/room-schedule-grid";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekdayName(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short" }).format(new Date(iso));
}

function insight(pct: number, status: string): { label: string; tone: "warn" | "accent" | "info" | "neutral" } {
  if (status === "maintenance") return { label: "In maintenance", tone: "neutral" };
  if (pct >= 80) return { label: "Near capacity", tone: "warn" };
  if (pct >= 40) return { label: "Healthy use", tone: "accent" };
  if (pct > 0) return { label: "Room to spare", tone: "info" };
  return { label: "Idle this week", tone: "neutral" };
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [detail, sites, clients, services, rooms, counsellors] = await Promise.all([
    provider.getRoomDetail(id, now),
    provider.listSites(membership.orgId),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
    provider.listCounsellors(membership.orgId),
  ]);
  if (!detail || detail.room.orgId !== membership.orgId) notFound();

  const { room, utilisation } = detail;
  const tip = insight(utilisation.utilisationPct, room.status);
  const scheduling = {
    orgId: membership.orgId,
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    businessHours: detail.businessHours,
  };
  const maxFree = Math.max(1, ...detail.perDay.map((d) => d.openMin));

  return (
    <div className="rise space-y-6">
      <Link href="/hub/rooms" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All rooms
      </Link>

      <PageHead
        title={
          <span className="flex items-center gap-2.5">
            <span className="size-3.5 rounded-full" style={{ backgroundColor: room.colour }} aria-hidden />
            {room.name}
          </span>
        }
        summary={detail.capacityNote}
        actions={
          <div className="flex items-center gap-2">
            <Tag tone={tip.tone}>{tip.label}</Tag>
            <EditRoomButton sites={sites.map((s) => ({ id: s.id, name: s.name }))} room={room} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-2">
        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {detail.siteName}</span>
        <span className="inline-flex items-center gap-1"><DoorOpen className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> Capacity {room.capacity}</span>
        <Tag tone={room.status === "active" ? "accent" : "warn"}>{room.status}</Tag>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat icon={Gauge} value={`${utilisation.utilisationPct}%`} label="Utilised this week" />
        <Stat icon={Clock} value={`${utilisation.bookedHours}h`} label="Booked" />
        <Stat icon={CalendarClock} value={`${detail.freeHours}h`} label="Free to book" />
        <Stat icon={DoorOpen} value={String(utilisation.meetings)} label={`Sessions · busiest ${weekdayName(utilisation.busiestDay)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Schedule */}
        <div>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">This week  click an open slot to book</h2>
          <RoomScheduleGrid
            roomId={room.id}
            roomName={room.name}
            colour={room.colour}
            days={detail.perDay.map((d) => ({ date: d.date, dow: d.dow, isToday: d.isToday }))}
            businessHours={detail.businessHours}
            bookings={detail.bookings}
            scheduling={scheduling}
          />
        </div>

        {/* Side */}
        <div className="space-y-6">
          <Card>
            <CardHead title="Availability" />
            <div className="space-y-2 px-[17px] pb-[17px]">
              {detail.perDay.map((d) => (
                <div key={d.date}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-2">{DOW[d.dow]}</span>
                    <span className="tabular-nums text-text-3">{Math.round(d.freeMin / 60 * 10) / 10}h free</span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full" style={{ width: `${(d.bookedMin / maxFree) * 100}%`, backgroundColor: room.colour }} />
                    <div className="h-full bg-accent-soft" style={{ width: `${(d.freeMin / maxFree) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-text-3">Filled = booked · light = available.</p>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Assigned counsellors"
              count={detail.assignments.length}
              action={<AssignCounsellorButton roomId={room.id} roomName={room.name} counsellors={scheduling.counsellors} />}
            />
            <div className="space-y-2 px-[17px] pb-[17px]">
              {detail.assignments.length === 0 ? (
                <EmptyState icon={DoorOpen} title="No assignments" body="Assign counsellors by day and time." />
              ) : (
                detail.assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Avatar name={a.counsellorName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-text">{a.counsellorName}</div>
                      <div className="text-[11.5px] text-text-3">{a.days.map((d) => DOW[d]).join(" & ")} · {a.start}–{a.end}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Gauge; value: string; label: string }) {
  return <StatCard icon={Icon} value={value} label={label} />;
}
