import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { ReportingView } from "@/components/hub/reporting-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports & funders" };

export default async function HubReportingPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = new Date().toISOString();

  const initial = await provider.getReporting(membership.orgId, now, {});

  await logAccess({
    action: "demographics.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/reporting`,
    reason: "open_reporting",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Reports & funders"
        summary="The reporting that falls out of the clinical work  consent-gated, k-anonymised, and one click from a funder report."
      />
      <ReportingView initial={initial} orgName={membership.orgName} />
    </div>
  );
}
