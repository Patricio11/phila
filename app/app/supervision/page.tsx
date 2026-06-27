import { notFound } from "next/navigation";
import { UserCog } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SupervisionQueue } from "@/components/workspace/supervision-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supervision" };

export default async function SupervisionPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  if (!me.isSupervisor) {
    return (
      <div className="rise space-y-6">
        <PageHead title="Supervision" />
        <Card className="p-2">
          <EmptyState
            icon={UserCog}
            title="Supervision is for supervisors"
            body="When you supervise other counsellors, their notes for sign-off will appear here."
          />
        </Card>
      </div>
    );
  }

  const now = new Date().toISOString();
  const items = await provider.getSupervisionQueue(me.id, now);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Supervision"
        summary={`${items.length} ${items.length === 1 ? "note" : "notes"} awaiting your sign-off.`}
      />
      <SupervisionQueue items={items} />
    </div>
  );
}
