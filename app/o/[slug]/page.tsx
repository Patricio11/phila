import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDataProvider } from "@/lib/data-provider";
import { OrgPublicShell } from "@/components/public/org-public-shell";

type Params = { slug: string };

/** Pre-render every org's public page (SSG); ISR-revalidated in Phase 17. */
export async function generateStaticParams(): Promise<Params[]> {
  const provider = await getDataProvider();
  const slugs = await provider.listOrgSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getDataProvider();
  const page = await provider.getOrgPublicPage(slug);
  if (!page) return { title: "Not found", robots: { index: false } };

  const title = `${page.org.name}  counselling in ${page.org.province}`;
  const description = page.intro;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `/o/${slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: page.org.name,
      locale: "en_ZA",
    },
  };
}

export default async function OrgPublicPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const provider = await getDataProvider();
  const page = await provider.getOrgPublicPage(slug);
  if (!page) notFound();

  // Honest, non-diagnostic structured data (DESIGN.md §9 / Rule: never diagnose).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: page.org.name,
    description: page.intro,
    areaServed: { "@type": "AdministrativeArea", name: page.org.province },
    address: { "@type": "PostalAddress", addressRegion: page.org.province, addressCountry: "ZA" },
    url: `https://philasa.com/o/${slug}`,
    availableService: page.services.map((s) => ({
      "@type": "Service",
      name: s.name,
      provider: { "@type": "MedicalBusiness", name: page.org.name },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <OrgPublicShell page={page} />
    </>
  );
}
