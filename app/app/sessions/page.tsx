import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { SessionsList } from "@/components/workspace/sessions-list";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sessions" };

export default async function SessionsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = clockNow();
  const sessions = await provider.listCounsellorSessions(membership.orgId, me.id, now);

  return (
    <div className="rise space-y-6">
      <PageHead title="Sessions" summary="Open a session to take notes, draft with AI, and sign." />
      <SessionsList sessions={sessions} nowISO={now} />
    </div>
  );
}
