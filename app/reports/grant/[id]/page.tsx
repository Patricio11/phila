import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { GrantReportPack } from "@/components/hub/grant-report-pack";
import { PrintReportBar } from "@/components/hub/print-report-button";
import { getOrgLogoDb } from "@/db/queries/settings";
import { getStorageProvider } from "@/lib/storage";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grant report", robots: { index: false } };

/**
 * The funder / M&E report pack — a standalone (shell-less) printable page so it saves
 * cleanly to PDF. Org-guarded; a grant that isn't the org's 404s. Reads are k-anonymised.
 */
export default async function GrantReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [view, org] = await Promise.all([
    provider.getGrantView(membership.orgId, id, now),
    provider.getOrg(membership.orgId),
  ]);
  if (!view || view.grant.orgId !== membership.orgId || !org) notFound();

  let logoUrl: string | null = null;
  if (process.env.DATA_PROVIDER === "db") {
    const { key } = await getOrgLogoDb(membership.orgId);
    if (key) { try { const s = await getStorageProvider(); if (s.status === "live") logoUrl = await s.signedDownloadUrl(key, 3600); } catch { /* wordmark fallback */ } }
  }

  await logAccess({
    action: "pii.export",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `grant:${id}/report_pack`,
    reason: "funder_report_k_anon",
  });

  return (
    <main className="min-h-dvh bg-surface-2">
      <PrintReportBar backHref={`/hub/grants/${id}`} />
      <div className="px-4 py-6 print:p-0">
        <div className="mx-auto max-w-[840px] overflow-hidden rounded-card bg-white shadow-e2 print:max-w-none print:rounded-none print:shadow-none">
          <GrantReportPack view={view} orgName={org.name} orgProvince={org.province} logoUrl={logoUrl} generatedAt={now} />
        </div>
      </div>
    </main>
  );
}
