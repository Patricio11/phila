import { Building2 } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GrantCard } from "@/components/funder/grant-card";
import { InviteFunderButton } from "@/components/funder/funder-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funders & grants" };

export default async function HubFundersPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const [funders, grants] = await Promise.all([
    provider.listFunders(membership.orgId),
    provider.listGrants(membership.orgId),
  ]);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Funders & grants"
        summary="Define a grant's targets once  the actuals roll up live from the clinical work."
        actions={<InviteFunderButton />}
      />

      {grants.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={Building2} title="No grants yet" body="Add a funder and a grant to start tracking indicators against targets." />
        </Card>
      ) : (
        <>
          <p className="text-[13px] text-text-2">
            {funders.length} {funders.length === 1 ? "funder" : "funders"} · {grants.length} active{" "}
            {grants.length === 1 ? "grant" : "grants"}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {grants.map((summary) => (
              <GrantCard key={summary.grant.id} summary={summary} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
