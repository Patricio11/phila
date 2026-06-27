import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { isoWeekday } from "@/lib/mock/helpers";
import { PageHead } from "@/components/shell/page-head";
import { CalendarWeek } from "@/components/workspace/calendar-week";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

function sastToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me || !org) notFound();

  const today = sastToday();
  // Monday of this week.
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

  const now = new Date().toISOString();
  const all = await provider.listCounsellorSessions(me.id, now);
  const events = all.filter((ev) => weekDates.some((d) => ev.startsAt.startsWith(d)));

  const label = `${new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${weekDates[0]}T12:00:00Z`))} – ${new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${weekDates[weekDates.length - 1]}T12:00:00Z`))}`;

  return (
    <div className="rise space-y-6">
      <PageHead title="Calendar" summary={`This week · ${label}`} />
      <CalendarWeek days={days} businessHours={org.scheduling.businessHours} events={events} />
    </div>
  );
}
