import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { HubClientsTable } from "@/components/hub/hub-clients-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function HubClientsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = new Date().toISOString();
  const rows = await provider.listOrgClients(membership.orgId, now);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/clients`,
    reason: "hub_oversight",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Clients"
        summary={`${rows.length} across the practice. Reassign or remove without distorting your reporting.`}
      />
      <HubClientsTable rows={rows} />
    </div>
  );
}
