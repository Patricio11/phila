import { notFound } from "next/navigation";
import { CalendarHeart } from "lucide-react";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionTimeline } from "@/components/client/session-timeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sessions" };

export default async function MeSessionsPage() {
  const { principal, clientId } = await requireClient();
  const provider = await getDataProvider();

  const client = await provider.getClient(clientId);
  if (!client) notFound();

  const now = new Date().toISOString();
  const nowMs = new Date(now).getTime();
  const appts = await provider.listAppointmentsForClient(clientId, now);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/sessions`,
    reason: "own_record",
  });

  const upcoming = appts.filter((a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled");
  const past = appts.filter((a) => !(new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled"));

  return (
    <div className="rise space-y-6">
      <PageHead title="Your sessions" summary="Everything from your first visit to your next one." />

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Upcoming</h2>
          <SessionTimeline appointments={upcoming} nowISO={now} />
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Past</h2>
        {past.length > 0 ? (
          <SessionTimeline appointments={past} nowISO={now} />
        ) : (
          <Card className="p-2">
            <EmptyState icon={CalendarHeart} title="No past sessions yet" body="Your session history will build up here over time." />
          </Card>
        )}
      </section>
    </div>
  );
}
