import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { ClassroomsBoard } from "@/components/hub/classrooms-board";
import type { ClassSummary } from "@/db/queries/classrooms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supervision" };

/**
 * Hub - supervision classrooms (batch 2). The org creates a class per
 * supervisor; supervisees join automatically and share a stream in /app.
 */
export default async function HubSupervisionPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);

  const classes: ClassSummary[] = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/classrooms")).listClassesDb(membership.orgId)
    : [];

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
        title="Supervision"
        summary="A classroom per supervisor - announcements, discussion, and the trainee group in one place. Clinical sign-off stays in each counsellor's workspace."
      />
      <ClassroomsBoard
        classes={classes}
        supervisors={counsellors.filter((c) => c.isSupervisor).map((c) => ({ id: c.id, name: c.name }))}
        counsellors={counsellors.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
