import { notFound } from "next/navigation";
import { Building2, CalendarClock, DoorOpen, MapPin } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { isoWeekday } from "@/lib/mock/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CounsellorWeekRooms } from "@/components/workspace/counsellor-week-rooms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rooms" };

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sastToday(now: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function CounsellorRoomsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = new Date().toISOString();
  const [view, org] = await Promise.all([
    provider.getCounsellorRooms(me.id, now),
    provider.getOrg(membership.orgId),
  ]);
  if (!org) notFound();
  const { assignments, bookings } = view;

  const today = sastToday(now);
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    .filter((d) => org.scheduling.businessHours[isoWeekday(d)])
    .map((date) => ({ date, dow: isoWeekday(date), isToday: date === today }));

  const daysInOffice = new Set(assignments.flatMap((a) => a.days)).size;
  const sites = new Set(assignments.map((a) => a.siteName)).size;

  return (
    <div className="rise space-y-6">
      <PageHead title="Your rooms" summary="Where you're working this week, and your in-person sessions." />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={DoorOpen} value={new Set(assignments.map((a) => a.roomName)).size} label="Rooms assigned" />
        <StatCard icon={CalendarClock} value={daysInOffice} label="Days in office" />
        <StatCard icon={MapPin} value={bookings.length} label="In-person this week" />
        <StatCard icon={Building2} value={sites} label={sites === 1 ? "Site" : "Sites"} />
      </div>

      {assignments.length === 0 && bookings.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={DoorOpen} title="No room assignments yet" body="Your practice manager assigns rooms by day and time." />
        </Card>
      ) : (
        <>
          <section>
            <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Your week</h2>
            <CounsellorWeekRooms days={weekDates} businessHours={org.scheduling.businessHours} assignments={assignments} bookings={bookings} />
          </section>

          {assignments.length > 0 && (
            <Card>
              <CardHead title="Your assignments" count={assignments.length} />
              <div className="grid gap-2 px-[17px] pb-[17px] sm:grid-cols-2">
                {assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-control border border-border p-3">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: a.colour }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-[600] text-text">{a.roomName}</div>
                      <div className="flex items-center gap-1 text-[12px] text-text-3">
                        <MapPin className="size-3.5" strokeWidth={2} aria-hidden /> {a.siteName}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[12px] text-text-2">
                      <div className="font-medium">{a.days.map((d) => DOW[d]).join(" & ")}</div>
                      <div className="tabular-nums text-text-3">{a.start}–{a.end}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
