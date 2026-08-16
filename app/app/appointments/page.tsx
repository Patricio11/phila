import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { CalendarView } from "@/components/calendar/calendar-view";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me || !org) notFound();

  const now = clockNow();
  const [events, allClients, services, rooms] = await Promise.all([
    provider.listCounsellorSessions(membership.orgId, me.id, now),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  // The counsellor's calendar is THEIRS alone: only their own sessions, only their
  // own clients, no team filter, and no booking - new work lives with the practice.
  const scheduling = {
    orgId: membership.orgId,
    defaultCounsellorId: me.id,
    clients: allClients.filter((c) => c.primaryCounsellorId === me.id).map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: [{ id: me.id, name: me.name }],
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    defaultDurationMin: org.scheduling.defaultDurationMin,
    bufferMin: org.scheduling.bufferMin,
    businessHours: org.scheduling.businessHours,
  };

  return (
    <div className="rise space-y-5">
      <PageHead title="Calendar" summary="Your week, day, month, or agenda  your own sessions only." />
      <CalendarView events={events} businessHours={org.scheduling.businessHours} scheduling={scheduling} nowISO={now} canCreate={false} openRef={ref ?? null} />
    </div>
  );
}
