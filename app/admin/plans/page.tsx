import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";
import { PageHead } from "@/components/shell/page-head";
import { PlansManager } from "@/components/admin/plans-manager";
import { LandingPricingToggle } from "@/components/admin/landing-pricing-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans & billing" };

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

export default async function AdminPlansPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const [plans, landingPricing] = await Promise.all([
    provider.listPlans(),
    getPlatformIntegrationStatus("landing_pricing"),
  ]);

  const mrr = plans.reduce((s, p) => s + p.mrrCents, 0);
  const subscribers = plans.reduce((s, p) => s + p.subscribers, 0);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Plans & billing"
        summary="Orgs subscribe to a Phila plan and pay Phila through Phila's own PSP. Entitlements come from this table  no drift."
      />

      <div className="grid grid-cols-2 gap-3.5 sm:max-w-md">
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="text-[22px] font-bold tabular-nums text-accent">{rands(mrr)}</div>
          <div className="text-[12px] text-text-2">Monthly recurring revenue</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="text-[22px] font-bold tabular-nums text-text">{subscribers}</div>
          <div className="text-[12px] text-text-2">Paying organisations</div>
        </div>
      </div>

      <LandingPricingToggle initial={landingPricing.enabled} />

      <PlansManager initial={plans} />
    </div>
  );
}
