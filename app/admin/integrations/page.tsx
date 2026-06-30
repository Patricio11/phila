import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { IntegrationsCatalogue } from "@/components/admin/integrations-catalogue";
import { PlatformPspCard } from "@/components/admin/platform-psp-card";
import { PlatformVideoCard } from "@/components/admin/platform-video-card";
import { PlatformStorageCard } from "@/components/admin/platform-storage-card";
import { getPlatformIntegrationStatus, getPlatformIntegration } from "@/db/queries/platform-integrations";
import { STORAGE_KEY } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const [items, paystack, livekitRaw, storageRaw] = await Promise.all([
    provider.listIntegrations(),
    getPlatformIntegrationStatus("paystack"),
    getPlatformIntegration("livekit"),
    getPlatformIntegration(STORAGE_KEY),
  ]);
  const storage = {
    enabled: storageRaw?.enabled ?? false,
    configured: Boolean(storageRaw?.creds.serviceKey),
    url: storageRaw?.creds.url ?? "",
    bucket: storageRaw?.creds.bucket ?? "",
  };
  const livekit = {
    enabled: livekitRaw?.enabled ?? false,
    configured: Boolean(livekitRaw?.creds.apiSecret),
    mode: (livekitRaw?.creds.mode === "live" ? "live" : "demo") as "demo" | "live",
    wsUrl: livekitRaw?.creds.wsUrl ?? "",
    apiKey: livekitRaw?.creds.apiKey ?? "",
  };

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Integrations"
        summary="Phila's own gateways (you configure + switch on here) and the catalogue of providers each org may connect for itself."
      />

      <Card>
        <CardHead title="Phila platform gateways" />
        <div className="space-y-3 px-[17px] pb-[17px]">
          <p className="text-[12.5px] text-text-3">Phila&apos;s own gateways  payments + video. Configure, test, then switch on. Encrypted at rest; never env vars.</p>
          <PlatformPspCard initial={paystack} />
          <PlatformVideoCard initial={livekit} />
          <PlatformStorageCard initial={storage} />
        </div>
      </Card>

      <IntegrationsCatalogue initial={items} />
    </div>
  );
}
