"use server";

import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { getStorageProvider } from "@/lib/storage";

/**
 * Counsellor document download (Phase 18). A counsellor may open a file only if
 * it's in their visible set  their own clients' documents, or something the Hub
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

  const storage = await getStorageProvider(doc.storageProvider);
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

/**
 * Batch 2k - a counsellor adds a LINK (e.g. their completed Google Doc) into a
 * folder the org shared with them. Only into shared folders; the document is
 * theirs (uploadedBy = their counsellor id), so in a submissions-private folder
 * no other counsellor ever sees it.
 */
export async function addSharedFolderLink(raw: { folderId: string; name: string; url: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };

  const name = String(raw?.name ?? "").trim();
  const url = String(raw?.url ?? "").trim();
  const folderId = String(raw?.folderId ?? "");
  if (name.length < 2) return { ok: false, error: "Name the link." };
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return { ok: false, error: "Enter a valid link (https://...)" };

  const { folderSharedWithDb, addLinkDocumentDb } = await import("@/db/queries/documents");
  if (!(await folderSharedWithDb(membership.orgId, folderId, me.id))) {
    return { ok: false, error: "That folder isn't shared with you." };
  }
  await addLinkDocumentDb(membership.orgId, {
    name, url, folderId, uploadedBy: me.id, sharedBy: "counsellor", counsellorId: me.id,
  });
  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `folder:${folderId}/link`,
    reason: "counsellor_add_link",
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/app/documents");
  revalidatePath("/hub/documents");
  return { ok: true };
}

/** Batch 2k - a counsellor edits their OWN link (wrong URL, better name). */
export async function updateMyLink(raw: { documentId: string; name: string; url: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };
  const name = String(raw?.name ?? "").trim();
  const url = String(raw?.url ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Name the link." };
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return { ok: false, error: "Enter a valid link (https://...)" };
  const { updateOwnLinkDb } = await import("@/db/queries/documents");
  const ok = await updateOwnLinkDb(membership.orgId, String(raw?.documentId ?? ""), me.id, { name, url });
  if (!ok) return { ok: false, error: "You can only edit your own links." };
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `document:${raw.documentId}`, reason: "counsellor_edit_link" });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/app/documents");
  revalidatePath("/hub/documents");
  return { ok: true };
}

/** Batch 2k - a counsellor removes their OWN link. */
export async function deleteMyLink(raw: { documentId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };
  const { deleteOwnLinkDb } = await import("@/db/queries/documents");
  const ok = await deleteOwnLinkDb(membership.orgId, String(raw?.documentId ?? ""), me.id);
  if (!ok) return { ok: false, error: "You can only remove your own links." };
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `document:${raw.documentId}`, reason: "counsellor_delete_link" });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/app/documents");
  revalidatePath("/hub/documents");
  return { ok: true };
}
