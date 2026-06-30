import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { IntegrationsTabs } from "@/components/admin/integrations-tabs";
import { getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";
import { PLATFORM_INTEGRATIONS } from "@/lib/admin/platform-integrations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();

  const [catalogue, statusEntries] = await Promise.all([
    provider.listIntegrations(),
    Promise.all(PLATFORM_INTEGRATIONS.map(async (m) => [m.slug, await getPlatformIntegrationStatus(m.key)] as const)),
  ]);
  const statuses = Object.fromEntries(statusEntries);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Integrations"
        summary="Phila's own platform gateways (you configure + switch on here) and the catalogue of providers each org may connect for itself."
      />
      <IntegrationsTabs statuses={statuses} catalogue={catalogue} />
    </div>
  );
}
