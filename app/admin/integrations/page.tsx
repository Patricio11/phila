import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { IntegrationsCatalogue } from "@/components/admin/integrations-catalogue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const items = await provider.listIntegrations();

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Integrations catalogue"
        summary="Curate what orgs can connect — messaging, video, and the payment providers an org may use for its own gateway."
      />
      <IntegrationsCatalogue initial={items} />
    </div>
  );
}
