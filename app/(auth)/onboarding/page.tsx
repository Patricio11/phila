import type { Metadata } from "next";
import { getDataProvider } from "@/lib/data-provider";
import { OnboardingWizard } from "@/components/auth/onboarding-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your practice · Phila", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const provider = await getDataProvider();
  const requirements = await provider.listOnboardingRequirements();
  return <OnboardingWizard requirements={requirements} />;
}
