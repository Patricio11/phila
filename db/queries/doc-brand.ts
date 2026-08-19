import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgs } from "@/db/schema";
import { getStorageProvider } from "@/lib/storage";
import { composeDocumentFooter } from "@/lib/forms/doc-footer";
import type { DocBrand } from "@/lib/export/response-pdf";
import type { OrgProfileData } from "@/lib/domain/types";

/**
 * Batch 4q - the practice's document identity for printed / on-screen form
 * documents: logo (short-lived signed URL), accent, footer (the practice's own
 * line, else composed from its profile). One read per page; pass it down.
 */
export async function getDocBrandDb(orgId: string, ttlSeconds = 3600): Promise<DocBrand & { composedFooter: string; ownFooter: string | null }> {
  const [row] = await getDb().select({ name: orgs.name, accent: orgs.brandAccent, logo: orgs.brandLogoKey, profile: orgs.profile, footer: orgs.documentFooter })
    .from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!row) return { orgName: "", logoUrl: null, accent: null, footer: null, composedFooter: "", ownFooter: null };
  let logoUrl: string | null = null;
  if (row.logo) {
    try {
      const storage = await getStorageProvider();
      if (storage.status === "live") logoUrl = await storage.signedDownloadUrl(row.logo, ttlSeconds);
    } catch { logoUrl = null; }
  }
  const composedFooter = composeDocumentFooter((row.profile as OrgProfileData | null) ?? {}, row.name);
  const ownFooter = (row.footer ?? "").trim() || null;
  return { orgName: row.name, logoUrl, accent: row.accent, footer: ownFooter ?? composedFooter, composedFooter, ownFooter };
}
