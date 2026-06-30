import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDataProvider } from "@/lib/data-provider";
import { OrgPublicShell } from "@/components/public/org-public-shell";
import { PageViewBeacon } from "@/components/public/page-view-beacon";

type Params = { slug: string };

/** Pre-render every org's public page (SSG) + ISR-revalidate hourly (Phase 17). */
export const revalidate = 3600;

export async function generateStaticParams(): Promise<Params[]> {
  const provider = await getDataProvider();
  const slugs = await provider.listOrgSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getDataProvider();
  const page = await provider.getOrgPublicPage(slug);
  if (!page) return { title: "Not found", robots: { index: false } };

  const title = page.content?.seoTitle || `${page.org.name}  counselling in ${page.org.province}`;
  const description = page.content?.seoDescription || page.intro;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `/o/${slug}` },
    openGraph: { type: "website", title, description, siteName: page.org.name, locale: "en_ZA", url: `/o/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function OrgPublicPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const provider = await getDataProvider();
  const page = await provider.getOrgPublicPage(slug);
  if (!page) notFound();

  // Honest, non-diagnostic structured data (never diagnose).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: page.org.name,
    description: page.content?.seoDescription || page.intro,
    medicalSpecialty: "Psychiatric",
    areaServed: { "@type": "AdministrativeArea", name: page.org.province },
    address: { "@type": "PostalAddress", addressRegion: page.org.province, addressCountry: "ZA" },
    ...(page.content?.contactEmail ? { email: page.content.contactEmail } : {}),
    ...(page.content?.contactPhone ? { telephone: page.content.contactPhone } : {}),
    url: `https://philasa.com/o/${slug}`,
    availableService: page.services.map((s) => ({ "@type": "Service", name: s.name, provider: { "@type": "MedicalBusiness", name: page.org.name } })),
    ...(page.content?.faqItems?.length ? {
      mainEntity: page.content.faqItems.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageViewBeacon slug={slug} />
      <OrgPublicShell page={page} />
    </>
  );
}
