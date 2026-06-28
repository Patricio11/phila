import { notFound } from "next/navigation";
import { UserCog } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SupervisionView } from "@/components/workspace/supervision-view";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supervision" };

export default async function SupervisionPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  if (!me.isSupervisor) {
    return (
      <div className="rise space-y-6">
        <PageHead title="Supervision" summary="Clinical oversight of the counsellors you supervise." />
        <Card className="p-2">
          <EmptyState
            icon={UserCog}
            title="Supervision is for supervisors"
            body="When the hub assigns you to supervise other counsellors, their notes for sign-off will appear here."
          />
        </Card>
      </div>
    );
  }

  const now = clockNow();
  const [items, overview] = await Promise.all([
    provider.getSupervisionQueue(me.id, now),
    provider.getSupervisionOverview(me.id, now),
  ]);

  await logAccess({
    action: "note.read_hub_override",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `supervisor:${me.id}/queue`,
    reason: "view_supervision_queue",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Supervision"
        summary={`${overview.supervisees.length} supervisee${overview.supervisees.length === 1 ? "" : "s"} · ${items.length} note${items.length === 1 ? "" : "s"} awaiting your sign-off.`}
      />
      <SupervisionView overview={overview} items={items} nowISO={now} />
    </div>
  );
}
