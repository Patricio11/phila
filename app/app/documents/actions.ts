"use server";

import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { getStorageProvider } from "@/lib/storage";

/**
 * Counsellor document download (Phase 18). A counsellor may open a file only if
 * it's in their visible set — their own clients' documents, or something the Hub
 * shared with them. Verified by re-deriving the set; clean files only; audited.
 */
export async function signCounsellorDownload(raw: { documentId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };

  const documentId = String(raw?.documentId ?? "");
  if (!documentId) return { ok: false, error: "Not found." };
  const { own, shared } = await provider.listCounsellorDocuments(me.id);
  const doc = [...own, ...shared].find((d) => d.id === documentId);
  if (!doc || !doc.storageKey || doc.scanStatus !== "clean") return { ok: false, error: "That file isn't available to open." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Files aren't available right now." };
  let url: string;
  try {
    url = await storage.signedDownloadUrl(doc.storageKey);
  } catch {
    return { ok: false, error: "Could not open the file." };
  }
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `document:${doc.id}`, reason: "download" });
  return { ok: true, url };
}
