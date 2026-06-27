import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { IntakeTracker } from "@/components/hub/intake-tracker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake" };

export default async function HubIntakePage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const now = new Date().toISOString();
  const rows = await provider.listIntakeStatus(membership.orgId, now);

  const completed = rows.filter((r) => r.status === "completed").length;
  const sent = rows.filter((r) => r.status === "sent").length;

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Intake"
        summary={`${completed} completed · ${sent} awaiting · send a form to a client or a whole programme cohort.`}
      />
      <IntakeTracker rows={rows} />
    </div>
  );
}
