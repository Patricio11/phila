import { CheckCircle2 } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { PlanPicker } from "@/components/hub/plan-picker";
import { getPlansDb, getPlanByIdDb } from "@/db/queries/plans";
import { confirmPlanCheckout } from "@/app/hub/billing/plan-actions";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Change plan" };

export default async function ChangePlanPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { membership } = await requireHub();
  const { ref } = await searchParams;

  let activated: string | null = null;
  if (ref) {
    const r = await confirmPlanCheckout(ref);
    if (r.active && r.planId) activated = (await getPlanByIdDb(r.planId))?.name ?? null;
  }

  const provider = await getDataProvider();
  const [sub, plans] = await Promise.all([
    provider.getOrgSubscription(membership.orgId, clockNow()),
    getPlansDb(),
  ]);

  return (
    <div className="rise space-y-6">
      <PageHead title="Your Phila plan" summary="Pick the plan that fits your practice. Billed to Phila  separate from your own client-payment gateway." />

      {activated && (
        <div className="flex items-center gap-2.5 rounded-card border border-accent/30 bg-accent-soft/40 px-4 py-3 text-[13px] text-text">
          <CheckCircle2 className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <p>You&apos;re now on the <b>{activated}</b> plan. Thank you  your subscription is active.</p>
        </div>
      )}

      <PlanPicker plans={plans} currentPlanId={sub?.plan.id ?? null} />

      <p className="text-[11.5px] text-text-3">Plans renew monthly. Changing plan takes effect immediately; you&apos;ll be charged for the new plan. Need a custom arrangement? Talk to Phila.</p>
    </div>
  );
}
