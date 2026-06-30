import type { MetadataRoute } from "next";

const BASE = process.env.BETTER_AUTH_URL ?? "https://philasa.com";

/** Public org pages are indexable; the app, hub, admin, and APIs are not (Phase 17). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/o/"],
      disallow: ["/app/", "/hub/", "/admin/", "/funder/", "/me/", "/api/", "/login", "/pay/", "/room/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
