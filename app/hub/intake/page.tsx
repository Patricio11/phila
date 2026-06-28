import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { IntakeTracker } from "@/components/hub/intake-tracker";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake" };

export default async function HubIntakePage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();
  const board = await provider.getIntakeBoard(membership.orgId, now);

  const completed = board.rows.filter((r) => r.status === "completed").length;
  const sent = board.rows.filter((r) => r.status === "sent").length;

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Intake"
        summary={`${completed} completed · ${sent} awaiting · review what clients sent, or send the form to someone new.`}
      />
      <IntakeTracker board={board} />
    </div>
  );
}
