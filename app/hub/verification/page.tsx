import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { getOrgOnboardingDataDb, type OrgOnboardingData } from "@/db/queries/onboarding";
import { PageHead } from "@/components/shell/page-head";
import { CompanyVerification } from "@/components/hub/company-verification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification" };

export default async function HubVerificationPage() {
  const { membership } = await requireHub();

  let data: OrgOnboardingData | null = null;
  if (process.env.DATA_PROVIDER === "db") {
    data = await getOrgOnboardingDataDb(membership.orgId);
  } else {
    // Mock/demo: the checklist is real; profile + doc state start empty.
    const provider = await getDataProvider();
    const reqs = await provider.listOnboardingRequirements();
    data = {
      name: "", status: "not_started", submittedAt: null, profile: {},
      docs: reqs.map((r) => ({ requirementId: r.id, label: r.label, description: r.description, required: r.required, status: "missing" as const, fileName: null, reviewNote: null, uploadedAt: null })),
    };
  }

  if (!data) {
    return (
      <div className="rise space-y-6">
        <PageHead title="Company verification" summary="We couldn't load your verification details." />
      </div>
    );
  }

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Company verification"
        summary="Complete your company profile and upload your registration documents. Verification unlocks client payouts and funder reporting  it doesn't affect your trial."
      />
      <CompanyVerification data={data} />
    </div>
  );
}
