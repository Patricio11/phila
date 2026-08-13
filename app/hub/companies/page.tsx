import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { PageHead } from "@/components/shell/page-head";
import { CompaniesBoard } from "@/components/hub/companies-board";
import type { CompanySummary } from "@/db/queries/companies";

export const dynamic = "force-dynamic";
export const metadata = { title: "Companies" };

/**
 * EAP companies (batch 2j) - employers who fund sessions for their staff. The
 * practice manages retainers and reporting here; employees stay invisible to
 * the company (aggregate-only, always).
 */
export default async function HubCompaniesPage() {
  const { principal, membership } = await requireHub();
  const now = clockNow();
  const org = await (await getDataProvider()).getOrg(membership.orgId);

  const companies: CompanySummary[] = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/companies")).listCompaniesDb(membership.orgId, now)
    : [];
  // Batch 2t - the forms an employer intake can be chosen from.
  const forms = process.env.DATA_PROVIDER === "db"
    ? (await (await import("@/db/queries/forms")).listFormsDb(membership.orgId))
        .filter((f) => f.status === "active")
        .map((f) => ({ id: f.id, title: f.title, kind: f.kind }))
    : [];

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/companies`,
    reason: "view_companies",
  });

  return (
    <div className="rise space-y-6">
      <Link href="/hub/clients" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 transition-colors hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All clients
      </Link>

      <PageHead
        title="Companies"
        summary="Employers who cover sessions for their staff. They see usage and money only - never who came."
      />
      <CompaniesBoard companies={companies} slug={org?.slug ?? ""} forms={forms} />
    </div>
  );
}
