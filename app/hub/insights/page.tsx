import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { InsightsWorkspace } from "@/components/hub/insights-workspace";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights" };

export default async function HubInsightsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [insights, reporting] = await Promise.all([
    provider.getHubInsights(membership.orgId, now, { period: "month" }),
    provider.getReporting(membership.orgId, now, {}),
  ]);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/insights`,
    reason: "open_insights",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Insights"
        summary="How your practice is going  sessions, attendance, revenue, and your client mix  plus consent-gated funder reporting. Real numbers, beautifully clear."
      />
      <InsightsWorkspace insights={insights} reporting={reporting} orgName={membership.orgName} />
    </div>
  );
}
