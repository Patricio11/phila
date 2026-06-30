"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireClient } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { getStorageProvider, objectKey } from "@/lib/storage";
import { storageLimitBytes, validateUpload } from "@/lib/documents/quota";
import { scanObject } from "@/lib/documents/scan";
import {
  addStorageUsage,
  currentStorageBytes,
  finalizeDocument,
  fulfilRequestDb,
  getClientDocumentRow,
  getRequestRow,
  insertClientUpload,
} from "@/db/queries/documents";

/**
 * Client document actions (Phase 18). A client may upload ONLY against an open
 * request from the practice (no unsolicited uploads), and may open only files
 * shared with them. The bytes go straight to Phila Storage via a presigned URL.
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

const uploadInput = z.object({
  requestId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(120),
  bytes: z.number().int().positive(),
});

export async function requestClientUpload(raw: z.infer<typeof uploadInput>): Promise<{ ok: true; uploadUrl: string; documentId: string } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const parsed = uploadInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the file." };
  const v = validateUpload({ contentType: parsed.data.contentType, bytes: parsed.data.bytes });
  if (!v.ok) return v;
  if (!isDb()) return { ok: false, error: "Uploads aren't available in this demo." };

  const req = await getRequestRow(parsed.data.requestId);
  if (!req || req.clientId !== clientId || req.status !== "pending") return { ok: false, error: "That request isn't open." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Uploads aren't switched on yet." };

  const used = await currentStorageBytes(req.orgId);
  if (used + parsed.data.bytes > storageLimitBytes()) return { ok: false, error: "Your practice's storage is full  they'll sort that out." };

  const documentId = `doc_${randomUUID()}`;
  const key = objectKey(req.orgId, documentId, parsed.data.name);
  let uploadUrl: string;
  try {
    ({ uploadUrl } = await storage.signedUploadUrl({ key, contentType: parsed.data.contentType }));
  } catch {
    return { ok: false, error: "Storage rejected the upload. Please try again." };
  }
  await insertClientUpload({ id: documentId, orgId: req.orgId, clientId, requestId: req.id, name: parsed.data.name, contentType: parsed.data.contentType, storageKey: key, uploadedBy: principal.userId });
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: "client", teamRole: null }, orgId: req.orgId, target: `document:${documentId}`, reason: "client_upload" });
  return { ok: true, uploadUrl, documentId };
}

const confirmInput = z.object({ documentId: z.string().min(1), bytes: z.number().int().positive() });
export async function confirmClientUpload(raw: z.infer<typeof confirmInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const parsed = confirmInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Could not finalise the upload." };
  if (!isDb()) return { ok: false, error: "Uploads aren't available in this demo." };

  const doc = await getClientDocumentRow(clientId, parsed.data.documentId);
  if (!doc || !doc.storageKey) return { ok: false, error: "Upload not found." };
  const scan = await scanObject(doc.storageKey);
  await finalizeDocument(doc.orgId, doc.id, parsed.data.bytes, scan);
  if (scan === "clean") await addStorageUsage(doc.orgId, parsed.data.bytes);
  if (doc.requestId) await fulfilRequestDb(doc.requestId, doc.id);
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: "client", teamRole: null }, orgId: doc.orgId, target: `document:${doc.id}`, reason: `client_upload_${scan}` });
  revalidatePath("/me/documents");
  return { ok: true };
}

export async function signClientDownload(raw: { documentId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const documentId = String(raw?.documentId ?? "");
  if (!documentId) return { ok: false, error: "Not found." };
  const doc = await getClientDocumentRow(clientId, documentId);
  if (!doc || !doc.storageKey || doc.visibility !== "client_visible" || doc.scanStatus !== "clean")
    return { ok: false, error: "That file isn't available to open." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Files aren't available right now." };
  let url: string;
  try {
    url = await storage.signedDownloadUrl(doc.storageKey);
  } catch {
    return { ok: false, error: "Could not open the file." };
  }
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: "client", teamRole: null }, orgId: doc.orgId, target: `document:${doc.id}`, reason: "download" });
  return { ok: true, url };
}
