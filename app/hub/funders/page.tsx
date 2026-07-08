import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GrantCard } from "@/components/funder/grant-card";
import { FunderList } from "@/components/funder/funder-list";
import { FunderFormButton } from "@/components/funder/funder-form-modal";
import { GrantFormButton } from "@/components/funder/grant-form-modal";
import { InviteFunderButton } from "@/components/funder/funder-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funders & grants" };

export default async function HubFundersPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const org = await provider.getOrg(membership.orgId);
  if (!org?.features.funders) redirect("/hub");
  const [funders, grants] = await Promise.all([
    provider.listFunders(membership.orgId),
    provider.listGrants(membership.orgId),
  ]);

  const funderOpts = funders.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="rise space-y-8">
      <PageHead
        title="Funders & grants"
        summary="Define each grant's targets once  the actuals roll up live from the clinical work, k-anonymised for the funder."
        actions={
          <div className="flex items-center gap-2">
            <FunderFormButton />
            <GrantFormButton funders={funderOpts} />
            {funders.length > 0 && <InviteFunderButton funders={funderOpts} grants={grants.map((g) => ({ id: g.grant.id, title: g.grant.title, funderId: g.grant.funderId }))} />}
          </div>
        }
      />

      {funders.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={Building2} title="No funders yet" body="Add a funder, then create a grant under it with its own targets and reporting schedule." action={<FunderFormButton />} />
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-[13px] font-[640] uppercase tracking-[0.05em] text-text-3">Funders · {funders.length}</h3>
            <FunderList funders={funders} />
          </section>

          <section className="space-y-3">
            <h3 className="text-[13px] font-[640] uppercase tracking-[0.05em] text-text-3">Grants · {grants.length}</h3>
            {grants.length === 0 ? (
              <Card className="p-2">
                <EmptyState icon={Building2} title="No grants yet" body="Create a grant under one of your funders to start tracking indicators against targets." action={<GrantFormButton funders={funderOpts} />} />
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {grants.map((summary) => (
                  <GrantCard key={summary.grant.id} summary={summary} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
