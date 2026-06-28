import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { OnboardingRequirementsEditor } from "@/components/admin/onboarding-requirements-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding" };

export default async function AdminOnboardingPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const requirements = await provider.listOnboardingRequirements();

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Onboarding requirements"
        summary="The documents every new practice must upload to be verified. They see exactly this checklist during sign-up."
      />
      <Card>
        <CardHead title="Required documents" count={requirements.length} />
        <div className="px-[17px] pb-[17px]">
          <OnboardingRequirementsEditor initial={requirements} />
        </div>
      </Card>
    </div>
  );
}
