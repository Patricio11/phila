import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { HubClientsTable } from "@/components/hub/hub-clients-table";
import { AddClientButton } from "@/components/hub/add-client-modal";
import { ImportClientsButton } from "@/components/hub/import-clients-modal";
import { DedupeBanner } from "@/components/hub/dedupe-clients";
import { phoneKey, emailKey } from "@/lib/import/validate";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function HubClientsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();
  const [rows, removedRows, counsellors, duplicates, org] = await Promise.all([
    provider.listOrgClients(membership.orgId, now),
    provider.listRemovedClients(membership.orgId, now),
    provider.listCounsellors(membership.orgId),
    provider.findDuplicateClients(membership.orgId, now),
    provider.getOrg(membership.orgId),
  ]);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/clients`,
    reason: "hub_oversight",
  });

  const counsellorOpts = counsellors.map((c) => ({ id: c.id, name: c.name }));
  // Dedupe keys of existing clients (live + removed) so the import skips repeats.
  const existingKeys = [...rows, ...removedRows]
    .flatMap((r) => [phoneKey(r.client.phone), emailKey(r.client.email)])
    .filter((k): k is string => Boolean(k));

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Clients"
        summary={`${rows.length} across the practice. Filter by status or counsellor, reassign, or remove and restore  reporting stays accurate.`}
        actions={
          <div className="flex items-center gap-2">
            <ImportClientsButton existingKeys={existingKeys} />
            <AddClientButton counsellors={counsellorOpts} inviteOnCreateDefault={Boolean(org?.clientPortal.inviteOnCreate)} />
          </div>
        }
      />

      <DedupeBanner groups={duplicates} />

      <HubClientsTable rows={rows} removedRows={removedRows} counsellors={counsellorOpts} />
    </div>
  );
}
