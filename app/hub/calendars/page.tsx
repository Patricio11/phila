import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendars" };

export default async function HubCalendarsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();

  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  if (!org) notFound();

  const now = new Date().toISOString();
  const [lists, orgClients, services, rooms] = await Promise.all([
    Promise.all(counsellors.map((c) => provider.listCounsellorSessions(c.id, now))),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  const events = lists.flat();
  const scheduling = {
    orgId: membership.orgId,
    clients: orgClients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    businessHours: org.scheduling.businessHours,
  };

  return (
    <div className="rise space-y-5">
      <PageHead
        title="Calendars"
        summary={`Every counsellor's sessions in one view  ${counsellors.length} counsellors. Click a slot to book on behalf.`}
      />
      <CalendarView events={events} businessHours={org.scheduling.businessHours} scheduling={scheduling} nowISO={now} openSessions={false} clientBasePath="/hub/clients" />
    </div>
  );
}
