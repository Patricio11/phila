import { requireSuperAdmin } from "@/lib/auth/guard";
import { getPlatformFeatureFlagsDb } from "@/db/queries/features";
import { FEATURE_LIST } from "@/lib/domain/features";
import { PageHead } from "@/components/shell/page-head";
import { FeatureMatrix } from "@/components/admin/feature-matrix";
import { PlatformFunctions } from "@/components/admin/platform-functions";
import { getPlatformSettingsDb } from "@/db/queries/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Features" };

export default async function AdminFeaturesPage() {
  await requireSuperAdmin();
  const flags = process.env.DATA_PROVIDER === "db" ? await getPlatformFeatureFlagsDb() : {};
  const platform = process.env.DATA_PROVIDER === "db" ? await getPlatformSettingsDb() : { vatRatePercent: 15, crisisSupportEnabled: false };

  const features = FEATURE_LIST.map((f) => ({ ...f, disabled: Boolean(flags[f.key]) }));

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Feature control"
        summary="Turn a feature off across the whole platform. A kill-switch overrides every plan and every org's own setting  use it for incidents or a phased rollout."
      />
      <FeatureMatrix features={features} />
      {/* Batch 4m - functions Phila switches ON for orgs (off until then) */}
      <PlatformFunctions crisisSupportEnabled={platform.crisisSupportEnabled} />
    </div>
  );
}
