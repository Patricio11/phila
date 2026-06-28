import { notFound } from "next/navigation";
import { Sprout } from "lucide-react";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { isConsentActive } from "@/lib/consent";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CareSteps } from "@/components/client/care-steps";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your steps" };

export default async function MeStepsPage() {
  const { clientId } = await requireClient();
  const provider = await getDataProvider();
  const client = await provider.getClient(clientId);
  if (!client) notFound();

  const [carePlan, consents] = await Promise.all([
    provider.getCarePlan(clientId),
    provider.getClientConsents(clientId),
  ]);
  const shared = consents.find((c) => c.purpose === "care_plan_share");
  const counsellor = client.primaryCounsellorId ? await provider.getCounsellor(client.primaryCounsellorId) : null;

  const visible = carePlan && isConsentActive(shared);

  return (
    <div className="rise space-y-5">
      <PageHead title="Your steps" summary="Small, kind things to try between sessions  at your own pace." />

      {visible ? (
        <Card>
          <div className="px-[17px] py-[17px]">
            <CareSteps
              tasks={carePlan.tasks}
              resources={carePlan.resources}
              nextStep={carePlan.nextStep}
              counsellorFirstName={counsellor?.name.split(" ")[0]}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-2">
          <EmptyState icon={Sprout} title="No steps yet" body="After a session, anything your counsellor suggests to try will appear here  gentle, and only when you're ready." />
        </Card>
      )}
    </div>
  );
}
