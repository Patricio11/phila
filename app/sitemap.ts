import type { MetadataRoute } from "next";
import { getDataProvider } from "@/lib/data-provider";

const BASE = process.env.BETTER_AUTH_URL ?? "https://philasa.com";

/** Per-org public pages in the sitemap (Phase 17). Internal routes stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let slugs: string[] = [];
  try {
    slugs = await (await getDataProvider()).listOrgSlugs();
  } catch {
    slugs = [];
  }
  const orgPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/o/${slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [
    { url: BASE, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/marketing`, changeFrequency: "monthly", priority: 0.9 },
    ...orgPages,
  ];
}
