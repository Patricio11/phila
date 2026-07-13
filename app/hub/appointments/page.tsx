import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { CalendarView } from "@/components/calendar/calendar-view";
import { ChangeRequestsCard } from "@/components/hub/change-requests-card";
import { WaitlistCard } from "@/components/hub/waitlist-card";
import { listPendingChangeRequestsDb } from "@/db/queries/appointment-requests";
import { listWaitlistDb } from "@/db/queries/waitlist";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments" };

export default async function HubCalendarsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();

  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  if (!org) notFound();

  const now = clockNow();
  const [lists, orgClients, services, rooms] = await Promise.all([
    Promise.all(counsellors.map((c) => provider.listCounsellorSessions(membership.orgId, c.id, now))),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  const events = lists.flat();
  const isDb = process.env.DATA_PROVIDER === "db";
  const [changeRequests, waitlist] = await Promise.all([
    isDb ? listPendingChangeRequestsDb(membership.orgId) : Promise.resolve([]),
    isDb ? listWaitlistDb(membership.orgId) : Promise.resolve([]),
  ]);
  const scheduling = {
    orgId: membership.orgId,
    clients: orgClients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    defaultDurationMin: org.scheduling.defaultDurationMin,
    businessHours: org.scheduling.businessHours,
  };

  return (
    <div className="rise space-y-5">
      <PageHead
        title="Appointments"
        summary={`Every counsellor's sessions in one view  ${counsellors.length} counsellors. Click a slot to book on behalf.`}
      />
      <ChangeRequestsCard initial={changeRequests} />
      <WaitlistCard initial={waitlist} options={scheduling} />
      <CalendarView events={events} businessHours={org.scheduling.businessHours} scheduling={scheduling} nowISO={now} openSessions={false} clientBasePath="/hub/clients" />
    </div>
  );
}
