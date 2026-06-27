import type { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { Hero } from "@/components/marketing/hero";
import { DailyLoop } from "@/components/marketing/daily-loop";
import { Pillars } from "@/components/marketing/pillars";
import { FunderStory } from "@/components/marketing/funder-story";
import { TrustBand } from "@/components/marketing/trust-band";
import { WhoItsFor } from "@/components/marketing/who-its-for";
import { Voice } from "@/components/marketing/voice";
import { ClosingCta, SiteFooter } from "@/components/marketing/closing";

/** The landing is the public face — it opts back into indexing (the app is noindex). */
export const metadata: Metadata = {
  title: "Phila — run the practice, hold the whole journey",
  description:
    "Phila is the calm operating system for South African counselling organisations — the daily clinical loop, programme-grade oversight, and funder reporting that falls out of the work. POPIA-grade, data kept in South Africa.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Phila — run the practice, hold the whole journey",
    description:
      "The calm operating system for South African counselling organisations. Built POPIA-first, with client data kept in South Africa.",
    siteName: "Phila",
    locale: "en_ZA",
  },
};

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <DailyLoop />
        <Pillars />
        <FunderStory />
        <TrustBand />
        <WhoItsFor />
        <Voice />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
