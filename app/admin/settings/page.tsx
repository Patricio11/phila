import { requireSuperAdmin } from "@/lib/auth/guard";
import { PageHead } from "@/components/shell/page-head";
import { FeatureFlags } from "@/components/admin/feature-flags";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  return (
    <div className="rise space-y-6">
      <PageHead title="Platform settings" summary="Feature flags and platform-wide controls." />
      <FeatureFlags />
    </div>
  );
}
