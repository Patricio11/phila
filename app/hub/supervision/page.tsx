import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { PageHead } from "@/components/shell/page-head";
import { ClassroomsBoard } from "@/components/hub/classrooms-board";
import type { ClassSessionView, ClassView } from "@/db/queries/classrooms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classroom" };

/**
 * Hub - supervision classrooms (batch 2). The org creates a class per
 * supervisor; supervisees join automatically and share a stream in /app.
 * Batch 2e: the org can OPEN any classroom - full stream, posting as the
 * practice, session links, scheduling (incl. weekly runs) and registers.
 */
export default async function HubSupervisionPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const now = clockNow();

  let streams: ClassView[] = [];
  let sessions: ClassSessionView[] = [];
  if (process.env.DATA_PROVIDER === "db") {
    const { listClassStreamsForOrgDb, sessionsForClassesDb } = await import("@/db/queries/classrooms");
    streams = await listClassStreamsForOrgDb(membership.orgId);
    sessions = await sessionsForClassesDb(membership.orgId, streams.map((c) => c.id));
  }
  const classes = streams;

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/supervision`,
    reason: "view_supervision_classrooms",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Classroom"
        summary="A classroom per supervisor - announcements, discussion, and the trainee group in one place. Clinical sign-off stays in each counsellor's workspace."
      />
      <ClassroomsBoard
        classes={classes}
        streams={streams}
        sessions={sessions}
        supervisors={counsellors.filter((c) => c.isSupervisor).map((c) => ({ id: c.id, name: c.name }))}
        counsellors={counsellors.map((c) => ({ id: c.id, name: c.name }))}
        nowISO={now}
        meUserId={principal.userId}
      />
    </div>
  );
}
