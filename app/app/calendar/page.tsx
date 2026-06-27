import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me || !org) notFound();

  const now = new Date().toISOString();
  const [events, allClients, services, rooms] = await Promise.all([
    provider.listCounsellorSessions(me.id, now),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  const scheduling = {
    orgId: membership.orgId,
    defaultCounsellorId: me.id,
    clients: allClients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
  };

  return (
    <div className="rise space-y-5">
      <PageHead title="Calendar" summary="Your week, day, month, or agenda — click a slot to book." />
      <CalendarView events={events} businessHours={org.scheduling.businessHours} scheduling={scheduling} nowISO={now} />
    </div>
  );
}
