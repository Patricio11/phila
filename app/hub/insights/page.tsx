import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { HubInsightsView } from "@/components/hub/hub-insights-view";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights" };

export default async function HubInsightsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const initial = await provider.getHubInsights(membership.orgId, now, { period: "month" });

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
        summary="How your practice is going — sessions by day, week, and month, attendance, revenue, and your client mix. Real numbers, for running the practice."
      />
      <HubInsightsView initial={initial} />
    </div>
  );
}
