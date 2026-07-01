import type { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { DailyLoop } from "@/components/marketing/daily-loop";
import { Pillars } from "@/components/marketing/pillars";
import { OnePlace } from "@/components/marketing/one-place";
import { ClientExperience } from "@/components/marketing/client-experience";
import { FunderStory } from "@/components/marketing/funder-story";
import { TrustBand } from "@/components/marketing/trust-band";
import { WhoItsFor } from "@/components/marketing/who-its-for";
import { Voice } from "@/components/marketing/voice";
import { Pricing } from "@/components/marketing/pricing";
import { ClosingCta, SiteFooter } from "@/components/marketing/closing";
import { getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";

// ISR  the page is static but re-checks the pricing switch periodically; the
// admin toggle also revalidates "/" for an immediate update.
export const revalidate = 60;

/** Whether the super-admin has switched the landing pricing on (default: hidden). */
async function pricingEnabled(): Promise<boolean> {
  try {
    return (await getPlatformIntegrationStatus("landing_pricing")).enabled;
  } catch {
    return false;
  }
}

/** The landing is the public face  it opts back into indexing (the app is noindex). */
export const metadata: Metadata = {
  title: "Phila  run the practice, hold the whole journey",
  description:
    "Phila is the calm operating system for South African counselling organisations  the daily clinical loop, programme-grade oversight, and funder reporting that falls out of the work. POPIA-grade, data kept in South Africa.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Phila  run the practice, hold the whole journey",
    description:
      "The calm operating system for South African counselling organisations. Built POPIA-first, with client data kept in South Africa.",
    siteName: "Phila",
    locale: "en_ZA",
  },
};

export default async function LandingPage() {
  const showPricing = await pricingEnabled();
  return (
    <>
      <SiteNav showPricing={showPricing} />
      <main>
        <Hero />
        <DailyLoop />
        <Pillars />
        <OnePlace />
        <ClientExperience />
        <FunderStory />
        <TrustBand />
        <WhoItsFor />
        <Voice />
        {showPricing && <Pricing />}
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
