import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { IntegrationsCatalogue } from "@/components/admin/integrations-catalogue";
import { PlatformPspCard } from "@/components/admin/platform-psp-card";
import { getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const [items, paystack] = await Promise.all([
    provider.listIntegrations(),
    getPlatformIntegrationStatus("paystack"),
  ]);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Integrations"
        summary="Phila's own gateways (you configure + switch on here) and the catalogue of providers each org may connect for itself."
      />

      <Card>
        <CardHead title="Phila platform gateways" />
        <div className="space-y-3 px-[17px] pb-[17px]">
          <p className="text-[12.5px] text-text-3">Phila&apos;s own payment gateway  it powers credit top-ups and plan billing. Configure the key, test it, then switch it on. Encrypted at rest; never an env var.</p>
          <PlatformPspCard initial={paystack} />
        </div>
      </Card>

      <IntegrationsCatalogue initial={items} />
    </div>
  );
}
