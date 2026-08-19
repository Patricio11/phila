import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { CounsellorForms } from "@/components/workspace/counsellor-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forms" };

/**
 * Batch 2l - the counsellor's forms: what the practice shared with them, who
 * they've sent it to, and the completed answers from their own clients.
 */
export default async function CounsellorFormsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const isDb = process.env.DATA_PROVIDER === "db";
  const { formsForCounsellorDb, counsellorClientsDb, clientFormResponsesDb, counsellorFillsDb } = await import("@/db/queries/form-automations");
  const forms = isDb ? await formsForCounsellorDb(membership.orgId, me.id) : [];
  // Batch 4p - forms the practice asked ME to fill in (about my clients).
  const toFill = isDb ? await counsellorFillsDb(membership.orgId, me.id) : [];
  const clients = isDb ? await counsellorClientsDb(membership.orgId, me.id) : [];
  // Responses across this counsellor's whole caseload, newest first.
  const responses = isDb
    ? (await Promise.all(clients.map(async (c) => (await clientFormResponsesDb(membership.orgId, c.id)).map((r) => ({ ...r, clientId: c.id, clientName: c.name })))))
        .flat()
        .sort((a, b) => (b.submittedAt ?? b.sentAt).localeCompare(a.submittedAt ?? a.sentAt))
    : [];

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `counsellor:${me.id}/forms`,
    reason: "own_caseload_forms",
  });

  return (
    <div className="rise space-y-6">
      <PageHead title="Forms" summary="Forms the practice shared with you, and what your clients have sent back." />
      <CounsellorForms forms={forms} clients={clients} responses={responses} toFill={toFill} />
    </div>
  );
}
