import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { FeatureFlags } from "@/components/admin/feature-flags";
import { PlatformVatSettings } from "@/components/admin/platform-vat-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const platform = await provider.getPlatformSettings();

  return (
    <div className="rise space-y-6">
      <PageHead title="Platform settings" summary="Feature flags and platform-wide controls." />
      <PlatformVatSettings initialRate={platform.vatRatePercent} />
      <FeatureFlags />
    </div>
  );
}
