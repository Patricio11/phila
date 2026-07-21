import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { assemblePopiaPackDb } from "@/db/queries/popia-pack";
import { PopiaPackReport } from "@/components/hub/popia-pack";
import { PrintReportBar } from "@/components/hub/print-report-button";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "POPIA compliance pack", robots: { index: false } };

/**
 * Phase 31.4 — the one-click POPIA pack: a standalone printable page (same
 * pattern as the grant report) assembling the org's live compliance evidence.
 * Generation is a PII export → fail-strict audited before anything renders.
 */
export default async function PopiaPackPage() {
  const { principal, membership } = await requireHub();

  await logAccess({
    action: "pii.export",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/popia_pack`,
    reason: "popia_pack_generated",
  });

  const pack = await assemblePopiaPackDb(membership.orgId, clockNow());
  if (!pack) notFound();

  return (
    <div className="min-h-screen bg-[#f2f2f2] print:bg-white">
      <PrintReportBar backHref="/hub/settings" backLabel="Back to settings" />
      <div className="mx-auto max-w-[800px] py-8 print:py-0">
        <div className="bg-white shadow-lg print:shadow-none">
          <PopiaPackReport pack={pack} />
        </div>
      </div>
    </div>
  );
}
