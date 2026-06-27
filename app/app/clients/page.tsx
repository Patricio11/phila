import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { CaseloadTable } from "@/components/workspace/caseload-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = new Date().toISOString();
  const rows = await provider.listCaseload(me.id, now);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `counsellor:${me.id}/caseload`,
    reason: "own_caseload",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Your clients"
        summary={`${rows.length} ${rows.length === 1 ? "person" : "people"} in your care.`}
      />
      <CaseloadTable rows={rows} />
    </div>
  );
}
