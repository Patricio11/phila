import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { CompanyDetailView } from "@/components/hub/company-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company" };

/** One EAP company: retainer ledger, aggregate usage, the employee link, and
 *  the aggregate-only report export. Employees stay invisible to the company. */
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, membership } = await requireHub();
  const { id } = await params;
  if (process.env.DATA_PROVIDER !== "db") notFound();

  const now = clockNow();
  const [detail, org] = await Promise.all([
    (await import("@/db/queries/companies")).companyDetailDb(membership.orgId, id, now),
    (await getDataProvider()).getOrg(membership.orgId),
  ]);
  if (!detail) notFound();

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `company:${id}`,
    reason: "view_company",
  });

  return <CompanyDetailView detail={detail} slug={org?.slug ?? ""} orgName={membership.orgName} nowISO={now} />;
}
