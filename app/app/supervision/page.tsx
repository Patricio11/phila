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
    // The SUPERVISED counsellor's own view (batch 2): who supervises you, where
    // your notes stand, and the feedback that came back.
    if (process.env.DATA_PROVIDER === "db") {
      const { getMySupervisionDb } = await import("@/db/queries/supervision");
      const { classesForCounsellorDb } = await import("@/db/queries/classrooms");
      const [view, classes] = await Promise.all([
        getMySupervisionDb(membership.orgId, me.id),
        classesForCounsellorDb(membership.orgId, me.id),
      ]);
      const { MySupervision } = await import("@/components/workspace/my-supervision");
      const { ClassStream } = await import("@/components/classroom/class-stream");
      return (
        <div className="rise space-y-6">
          <PageHead title="Your supervision" summary="Your supervisor, where your notes stand, and their feedback." />
          <MySupervision view={view} />
          {classes.map((cls) => <ClassStream key={cls.id} cls={cls} />)}
        </div>
      );
    }
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
    provider.getSupervisionQueue(membership.orgId, me.id, now),
    provider.getSupervisionOverview(membership.orgId, me.id, now),
  ]);

  await logAccess({
    action: "note.read_hub_override",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `supervisor:${me.id}/queue`,
    reason: "view_supervision_queue",
  });

  // The supervisor's classrooms (batch 2) — stream + members under the queue.
  const classes = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/classrooms")).classesForCounsellorDb(membership.orgId, me.id)
    : [];
  const { ClassStream } = await import("@/components/classroom/class-stream");

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Supervision"
        summary={`${overview.supervisees.length} supervisee${overview.supervisees.length === 1 ? "" : "s"} · ${items.length} note${items.length === 1 ? "" : "s"} awaiting your sign-off.`}
      />
      <SupervisionView overview={overview} items={items} nowISO={now} />
      {classes.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-3">Your classrooms</h2>
          {classes.map((cls) => <ClassStream key={cls.id} cls={cls} showCode />)}
        </section>
      )}
    </div>
  );
}
