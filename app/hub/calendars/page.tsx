import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { isoWeekday } from "@/lib/mock/helpers";
import { PageHead } from "@/components/shell/page-head";
import { CalendarWeek } from "@/components/workspace/calendar-week";
import { CreateAppointmentButton } from "@/components/scheduling/create-appointment-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendars" };

function sastToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function HubCalendarsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();

  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  if (!org) notFound();

  const now = new Date().toISOString();
  const today = sastToday();
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter(
    (d) => org.scheduling.businessHours[isoWeekday(d)],
  );
  const days = weekDates.map((date) => ({
    date,
    dow: new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`)),
    day: new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric" }).format(new Date(`${date}T12:00:00Z`)),
    isToday: date === today,
  }));

  // Everyone's sessions, merged.
  const [lists, orgClients, services, rooms] = await Promise.all([
    Promise.all(counsellors.map((c) => provider.listCounsellorSessions(c.id, now))),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  const events = lists.flat().filter((ev) => weekDates.some((d) => ev.startsAt.startsWith(d)));
  const scheduling = {
    orgId: membership.orgId,
    clients: orgClients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
  };

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Calendars"
        summary={`Every counsellor's week in one view — ${counsellors.length} counsellors. Drag to reschedule.`}
        actions={<CreateAppointmentButton options={scheduling} label="Book on behalf" />}
      />
      <CalendarWeek days={days} businessHours={org.scheduling.businessHours} events={events} openSessions={false} />
    </div>
  );
}
