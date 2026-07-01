import type { Metadata } from "next";
import { getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";
import { SiteNav } from "@/components/marketing/site-nav";
import { Pricing } from "@/components/marketing/pricing";
import { ClosingCta, SiteFooter } from "@/components/marketing/closing";
import { HowItWorks, MarketingHero, PricingTeaser, Problem, Proof, WhatChanges, WhoFor, WhyPhila } from "@/components/marketing/funnel";

export const metadata: Metadata = {
  title: "Phila  the calm operating system for SA counselling teams",
  description:
    "Booking, the daily clinical loop, your team, documents, invoicing, and funder reporting in one calm place. Built POPIA-first, with client data kept in South Africa. No medical-aid claims.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/marketing" },
  openGraph: {
    type: "website",
    title: "Phila  run your whole counselling practice from one calm place",
    description: "One system for SA counselling organisations: booking, sessions, team, documents, invoicing, and funder reporting that falls out of the work.",
    siteName: "Phila",
    locale: "en_ZA",
  },
};

// ISR  static, but re-checks the pricing switch; the admin toggle revalidates "/".
export const revalidate = 60;

async function pricingEnabled(): Promise<boolean> {
  try {
    return (await getPlatformIntegrationStatus("landing_pricing")).enabled;
  } catch {
    return false;
  }
}

export default async function MarketingPage() {
  const showPricing = await pricingEnabled();
  return (
    <>
      <SiteNav showPricing={showPricing} />
      <main>
        <MarketingHero />
        <Problem />
        <WhoFor />
        <WhatChanges />
        <HowItWorks />
        <Proof />
        <WhyPhila />
        {showPricing ? <Pricing /> : <PricingTeaser />}
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
