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
  // Batch 4k - one access rule: own clients' files, direct shares, files in
  // shared folders, and everything a supervisee holds.
  const { counsellorAccessibleDocumentDb } = await import("@/db/queries/documents");
  const doc = await counsellorAccessibleDocumentDb(me.id, documentId);
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

  // Batch 2r - the practice hears about a submission the moment it lands, with
  // enough to act on: who, what, and which folder. Never breaks the save.
  try {
    const { notifyOrgAdmins } = await import("@/db/queries/notifications");
    const { folderNameDb } = await import("@/db/queries/documents");
    const where = await folderNameDb(membership.orgId, folderId);
    await notifyOrgAdmins(membership.orgId, {
      kind: "document_submitted",
      title: `${me.name} added a link`,
      body: `"${name}"${where ? ` in ${where}` : ""}. Open Documents to read it.`,
      href: "/hub/documents",
    });
  } catch { /* the link is saved either way */ }

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

/* ── A counsellor answers the practice's document request (batch 2z) ─────────
 * Same presign → PUT → confirm shape as every other upload. The file lands in
 * THEIR folder, the request is marked fulfilled, and the practice's bell rings.
 */
export async function requestFulfilUpload(raw: { requestId: string; name: string; contentType: string; bytes: number }): Promise<{ ok: true; uploadUrl: string; documentId: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };

  const requestId = String(raw?.requestId ?? "");
  const name = String(raw?.name ?? "").trim().slice(0, 160);
  const contentType = String(raw?.contentType ?? "").trim().slice(0, 120);
  const bytes = Number(raw?.bytes ?? 0);
  if (!requestId || !name || !contentType || !(bytes > 0)) return { ok: false, error: "Check the file." };

  const { validateUpload } = await import("@/lib/documents/quota");
  const v = validateUpload({ contentType, bytes, name });
  if (!v.ok) return v;

  // The request must be MINE and still open - a token guessed or stale is refused.
  const { getRequestRow, currentStorageBytes, insertPendingDocument, ensureCounsellorFolderDb } = await import("@/db/queries/documents");
  const req = await getRequestRow(requestId);
  if (!req || req.orgId !== membership.orgId || req.counsellorId !== me.id) return { ok: false, error: "That request isn't yours." };
  if (req.status !== "pending") return { ok: false, error: "That request has already been answered." };

  const { getStorageProvider: getStore, activeStorageBackend: backend, objectKey } = await import("@/lib/storage");
  const storage = await getStore();
  if (storage.status !== "live") return { ok: false, error: "Phila Storage isn't switched on yet." };
  const { orgStorageLimitBytes } = await import("@/db/queries/resources");
  if ((await currentStorageBytes(membership.orgId)) + bytes > (await orgStorageLimitBytes(membership.orgId)))
    return { ok: false, error: "Your practice has reached its storage. Ask an admin to make room." };

  // The file lands in the counsellor's own folder - where their things live.
  const { folderId } = await ensureCounsellorFolderDb(membership.orgId, me, "system");
  const documentId = `doc_${crypto.randomUUID()}`;
  const key = objectKey(membership.orgId, documentId, name);
  let uploadUrl: string;
  try {
    ({ uploadUrl } = await storage.signedUploadUrl({ key, contentType }));
  } catch {
    return { ok: false, error: "Storage rejected the upload - check the Phila Storage configuration." };
  }
  await insertPendingDocument({
    id: documentId, orgId: membership.orgId, folderId, name, contentType,
    storageKey: key, storageBackend: await backend(), uploadedBy: me.id,
    counsellorId: me.id, requestId, sharedBy: "counsellor",
  });
  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `document:${documentId}`,
    reason: "counsellor_request_upload",
  });
  return { ok: true, uploadUrl, documentId };
}

export async function confirmFulfilUpload(raw: { documentId: string; bytes: number }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };
  const documentId = String(raw?.documentId ?? "");
  const bytes = Number(raw?.bytes ?? 0);
  if (!documentId || !(bytes > 0)) return { ok: false, error: "Could not finalise the upload." };

  const { getDocumentRow, finalizeDocument, addStorageUsage, fulfilRequestDb, folderNameDb } = await import("@/db/queries/documents");
  const doc = await getDocumentRow(membership.orgId, documentId);
  if (!doc || !doc.storageKey || doc.uploadedBy !== me.id) return { ok: false, error: "Upload not found." };

  const { scanObject } = await import("@/lib/documents/scan");
  const scan = await scanObject(doc.storageKey);
  await finalizeDocument(membership.orgId, documentId, bytes, scan);
  if (scan !== "clean") return { ok: false, error: "That file didn't pass the security scan." };
  await addStorageUsage(membership.orgId, bytes);
  if (doc.requestId) await fulfilRequestDb(doc.requestId, documentId);

  // The practice hears the ask was answered, named and placed.
  try {
    const { notifyOrgAdmins } = await import("@/db/queries/notifications");
    const where = doc.folderId ? await folderNameDb(membership.orgId, doc.folderId) : null;
    await notifyOrgAdmins(membership.orgId, {
      kind: "document_submitted",
      title: `${me.name} uploaded a requested document`,
      body: `"${doc.name}"${where ? ` in ${where}` : ""}. The request is fulfilled.`,
      href: "/hub/documents",
    });
  } catch { /* the upload stands either way */ }

  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `document:${documentId}`,
    reason: `counsellor_upload_${scan}`,
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/app/documents");
  revalidatePath("/hub/documents");
  return { ok: true };
}

/* ── Batch 4k - counsellors upload files (not just links) ──────────────── */

/**
 * A counsellor uploads a file into their OWN folder, a folder the practice
 * shared with them, or onto one of THEIR clients' records. Same quota, same
 * scan, same honest states as the practice's uploads; the document is theirs
 * (uploadedBy = their id) so a submissions-private folder keeps it private.
 */
export async function requestCounsellorUpload(raw: { folderId?: string | null; clientId?: string | null; name: string; contentType: string; bytes: number }): Promise<{ ok: true; uploadUrl: string; documentId: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };

  const name = String(raw?.name ?? "").trim().slice(0, 160);
  const contentType = String(raw?.contentType ?? "").trim().slice(0, 120);
  const bytes = Number(raw?.bytes ?? 0);
  const clientId = raw?.clientId ? String(raw.clientId) : null;
  let folderId = raw?.folderId ? String(raw.folderId) : null;
  if (!name || !contentType || !(bytes > 0)) return { ok: false, error: "Check the file." };

  const { validateUpload } = await import("@/lib/documents/quota");
  const v = validateUpload({ contentType, bytes, name });
  if (!v.ok) return v;

  const q = await import("@/db/queries/documents");
  if (clientId) {
    // Only a client on MY caseload.
    const mine = (await provider.listClients(membership.orgId)).find((c) => c.id === clientId && c.primaryCounsellorId === me.id);
    if (!mine) return { ok: false, error: "You can only upload for clients on your caseload." };
    folderId = null;
  } else if (folderId) {
    // My own folder, or one the practice shared with me.
    const own = await q.ensureCounsellorFolderDb(membership.orgId, me, "system");
    if (folderId !== own.folderId && !(await q.folderSharedWithDb(membership.orgId, folderId, me.id))) {
      return { ok: false, error: "That folder isn't shared with you." };
    }
  } else {
    // Nowhere named: it lands in my own folder.
    ({ folderId } = await q.ensureCounsellorFolderDb(membership.orgId, me, "system"));
  }

  const { getStorageProvider: getStore, activeStorageBackend: backend, objectKey } = await import("@/lib/storage");
  const storage = await getStore();
  if (storage.status !== "live") return { ok: false, error: "Phila Storage isn't switched on yet." };
  const { orgStorageLimitBytes } = await import("@/db/queries/resources");
  if ((await q.currentStorageBytes(membership.orgId)) + bytes > (await orgStorageLimitBytes(membership.orgId)))
    return { ok: false, error: "Your practice has reached its storage. Ask an admin to make room." };

  const documentId = `doc_${crypto.randomUUID()}`;
  const key = objectKey(membership.orgId, documentId, name);
  let uploadUrl: string;
  try {
    ({ uploadUrl } = await storage.signedUploadUrl({ key, contentType }));
  } catch {
    return { ok: false, error: "Storage rejected the upload - check the Phila Storage configuration." };
  }
  await q.insertPendingDocument({
    id: documentId, orgId: membership.orgId, folderId, clientId, name, contentType,
    storageKey: key, storageBackend: await backend(), uploadedBy: me.id,
    counsellorId: me.id, sharedBy: "counsellor", visibility: "internal",
  });
  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `document:${documentId}`,
    reason: clientId ? "counsellor_upload_client" : "counsellor_upload_folder",
  });
  return { ok: true, uploadUrl, documentId };
}

export async function confirmCounsellorUpload(raw: { documentId: string; bytes: number }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };
  const documentId = String(raw?.documentId ?? "");
  const bytes = Number(raw?.bytes ?? 0);
  if (!documentId || !(bytes > 0)) return { ok: false, error: "Could not finalise the upload." };

  const { getDocumentRow, finalizeDocument, addStorageUsage } = await import("@/db/queries/documents");
  const doc = await getDocumentRow(membership.orgId, documentId);
  if (!doc || !doc.storageKey || doc.uploadedBy !== me.id) return { ok: false, error: "Upload not found." };

  const { scanObject } = await import("@/lib/documents/scan");
  const scan = await scanObject(doc.storageKey);
  await finalizeDocument(membership.orgId, documentId, bytes, scan);
  if (scan !== "clean") return { ok: false, error: "That file didn't pass the security scan." };
  await addStorageUsage(membership.orgId, bytes);
  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `document:${documentId}`,
    reason: `counsellor_upload_${scan}`,
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/app/documents");
  revalidatePath("/hub/documents");
  return { ok: true };
}
