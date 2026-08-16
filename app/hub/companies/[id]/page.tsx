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
  const provider = await getDataProvider();
  const companiesQ = await import("@/db/queries/companies");
  const [detail, org, employees, forms, clientsList, services, counsellors, rooms] = await Promise.all([
    companiesQ.companyDetailDb(membership.orgId, id, now),
    provider.getOrg(membership.orgId),
    // Batch 2t - practice-only: who is linked, and who is still waiting.
    companiesQ.companyEmployeesDb(membership.orgId, id, now),
    (await import("@/db/queries/forms")).listFormsDb(membership.orgId),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listCounsellors(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  if (!detail || !org) notFound();

  // Batch 3f - the employer's folder under Documents -> Companies. Ensured on
  // every visit, so it can never be missing and a deleted one heals itself.
  const { ensureCompanyFolderDb, folderDocumentsDb } = await import("@/db/queries/documents");
  const folderId = await ensureCompanyFolderDb(membership.orgId, { id: detail.id, name: detail.name });
  const [companyDocs, storageStatus] = await Promise.all([
    folderDocumentsDb(membership.orgId, folderId),
    (await import("@/lib/storage")).getStorageStatus(),
  ]);

  // Everything the Book button needs, so an employer's list books in one step.
  const scheduling = {
    orgId: membership.orgId,
    clients: clientsList.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    defaultDurationMin: org.scheduling.defaultDurationMin,
    bufferMin: org.scheduling.bufferMin,
    businessHours: org.scheduling.businessHours,
  };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `company:${id}`,
    reason: "view_company",
  });

  return (
    <CompanyDetailView
      detail={detail}
      slug={org.slug}
      orgName={membership.orgName}
      nowISO={now}
      forms={forms.filter((f) => f.status === "active").map((f) => ({ id: f.id, title: f.title, kind: f.kind }))}
      employees={employees}
      scheduling={scheduling}
      documentsFolderId={folderId}
      documents={companyDocs}
      storageEnabled={storageStatus.enabled && storageStatus.configured}
    />
  );
}
