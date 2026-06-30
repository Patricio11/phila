import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import {
  clients,
  documents,
  documentFolders,
  documentRequests,
  documentShares,
  orgStorageUsage,
} from "@/db/schema";
import type { Document, DocumentFolder, DocumentRequest, StorageUsage } from "@/lib/domain/types";
import type {
  DocumentKind,
  DocumentSharedBy,
  DocumentVisibility,
  FolderScope,
  ScanStatus,
  ShareTargetType,
  StorageBackend,
} from "@/lib/domain/enums";
import { sizeLabel, storageLimitBytes } from "@/lib/documents/quota";

/* ── Row → domain mappers ──────────────────────────────────────────────── */

function toDocument(r: typeof documents.$inferSelect): Document {
  return {
    id: r.id, orgId: r.orgId, folderId: r.folderId, clientId: r.clientId,
    counsellorId: r.counsellorId, sessionId: r.sessionId, name: r.name,
    kind: r.kind as DocumentKind, visibility: r.visibility as DocumentVisibility,
    storageProvider: r.storageProvider as StorageBackend, storageKey: r.storageKey,
    contentType: r.contentType, bytes: r.bytes, sizeLabel: r.sizeLabel,
    scanStatus: r.scanStatus as ScanStatus, uploadedBy: r.uploadedBy,
    sharedBy: r.sharedBy as DocumentSharedBy, requestId: r.requestId,
    createdAt: r.createdAt.toISOString(),
  };
}

function toFolder(r: typeof documentFolders.$inferSelect): DocumentFolder {
  return {
    id: r.id, orgId: r.orgId, parentId: r.parentId, name: r.name,
    scope: r.scope as FolderScope, clientId: r.clientId, createdAt: r.createdAt.toISOString(),
  };
}

function toRequest(r: typeof documentRequests.$inferSelect): DocumentRequest {
  return {
    id: r.id, orgId: r.orgId, clientId: r.clientId, requestedBy: r.requestedBy,
    title: r.title, note: r.note, status: r.status as DocumentRequest["status"],
    dueAt: r.dueAt ? r.dueAt.toISOString() : null, fulfilledDocumentId: r.fulfilledDocumentId,
    createdAt: r.createdAt.toISOString(),
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function listOrgDocumentsDb(orgId: string): Promise<Document[]> {
  const rows = await getDb().select().from(documents)
    .where(and(eq(documents.orgId, orgId), isNull(documents.deletedAt)));
  return rows.map(toDocument);
}

export async function listOrgFoldersDb(orgId: string): Promise<DocumentFolder[]> {
  const rows = await getDb().select().from(documentFolders)
    .where(and(eq(documentFolders.orgId, orgId), isNull(documentFolders.deletedAt)));
  return rows.map(toFolder);
}

export async function listDocumentRequestsDb(orgId: string): Promise<DocumentRequest[]> {
  const rows = await getDb().select().from(documentRequests).where(eq(documentRequests.orgId, orgId));
  return rows.map(toRequest);
}

export async function getStorageUsageDb(orgId: string): Promise<StorageUsage> {
  const [row] = await getDb().select().from(orgStorageUsage)
    .where(eq(orgStorageUsage.orgId, orgId)).limit(1);
  return { orgId, bytesUsed: row?.bytesUsed ?? 0, bytesLimit: storageLimitBytes() };
}

/* ── Writes (org-scoped; the UI's tactile operations) ──────────────────── */

export async function createFolderDb(
  orgId: string,
  input: { name: string; parentId: string | null; scope?: FolderScope; clientId?: string | null; createdBy?: string | null },
): Promise<string> {
  const id = `fold_${randomUUID()}`;
  await getDb().insert(documentFolders).values({
    id, orgId, name: input.name, parentId: input.parentId ?? null,
    scope: input.scope ?? "org", clientId: input.clientId ?? null,
    createdBy: input.createdBy ?? null, createdAt: new Date(),
  });
  return id;
}

export async function renameFolderDb(orgId: string, folderId: string, name: string): Promise<void> {
  await getDb().update(documentFolders).set({ name })
    .where(and(eq(documentFolders.orgId, orgId), eq(documentFolders.id, folderId)));
}

/** Move documents and/or folders into a target folder (null = root). One metadata write. */
export async function moveItemsDb(
  orgId: string,
  items: { documentIds: string[]; folderIds: string[] },
  targetFolderId: string | null,
): Promise<void> {
  const db = getDb();
  if (items.documentIds.length)
    await db.update(documents).set({ folderId: targetFolderId })
      .where(and(eq(documents.orgId, orgId), inArray(documents.id, items.documentIds)));
  if (items.folderIds.length)
    await db.update(documentFolders).set({ parentId: targetFolderId })
      .where(and(eq(documentFolders.orgId, orgId), inArray(documentFolders.id, items.folderIds)));
}

export async function assignToClientDb(orgId: string, documentIds: string[], clientId: string): Promise<void> {
  if (!documentIds.length) return;
  await getDb().update(documents).set({ clientId })
    .where(and(eq(documents.orgId, orgId), inArray(documents.id, documentIds)));
}

export async function setVisibilityDb(orgId: string, documentIds: string[], visibility: DocumentVisibility): Promise<void> {
  if (!documentIds.length) return;
  await getDb().update(documents).set({ visibility })
    .where(and(eq(documents.orgId, orgId), inArray(documents.id, documentIds)));
}

export async function softDeleteItemsDb(orgId: string, items: { documentIds: string[]; folderIds: string[] }): Promise<void> {
  const db = getDb();
  const now = new Date();
  if (items.documentIds.length)
    await db.update(documents).set({ deletedAt: now })
      .where(and(eq(documents.orgId, orgId), inArray(documents.id, items.documentIds)));
  if (items.folderIds.length)
    await db.update(documentFolders).set({ deletedAt: now })
      .where(and(eq(documentFolders.orgId, orgId), inArray(documentFolders.id, items.folderIds)));
}

export async function shareWithCounsellorDb(
  orgId: string, targetType: ShareTargetType, targetId: string, sharedWith: string, grantedBy: string,
): Promise<void> {
  await getDb().insert(documentShares).values({
    id: `share_${randomUUID()}`, orgId, targetType, targetId, sharedWith, grantedBy, createdAt: new Date(),
  }).onConflictDoNothing();
}

export async function createRequestDb(
  orgId: string, input: { clientId: string; requestedBy: string; title: string; note?: string | null },
): Promise<string> {
  const id = `docreq_${randomUUID()}`;
  await getDb().insert(documentRequests).values({
    id, orgId, clientId: input.clientId, requestedBy: input.requestedBy,
    title: input.title, note: input.note ?? null, status: "pending", createdAt: new Date(),
  });
  return id;
}

/* ── Upload lifecycle (presigned: request → PUT → confirm) ─────────────── */

export async function getDocumentRow(orgId: string, documentId: string): Promise<Document | null> {
  const [r] = await getDb().select().from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.id, documentId))).limit(1);
  return r ? toDocument(r) : null;
}

export async function currentStorageBytes(orgId: string): Promise<number> {
  const [row] = await getDb().select({ b: orgStorageUsage.bytesUsed }).from(orgStorageUsage)
    .where(eq(orgStorageUsage.orgId, orgId)).limit(1);
  return row?.b ?? 0;
}

/** Insert a `pending` document row (bytes land on confirm; not downloadable until scanned). */
export async function insertPendingDocument(input: {
  id: string; orgId: string; folderId: string | null; name: string; contentType: string;
  storageKey: string; uploadedBy: string | null;
}): Promise<void> {
  await getDb().insert(documents).values({
    id: input.id, orgId: input.orgId, folderId: input.folderId, name: input.name,
    kind: "upload", visibility: "internal", storageProvider: "supabase", storageKey: input.storageKey,
    contentType: input.contentType, bytes: 0, sizeLabel: "…", scanStatus: "pending",
    uploadedBy: input.uploadedBy, sharedBy: "org", createdAt: new Date(),
  });
}

export async function finalizeDocument(orgId: string, documentId: string, bytes: number, scanStatus: ScanStatus): Promise<void> {
  await getDb().update(documents).set({ bytes, sizeLabel: sizeLabel(bytes), scanStatus })
    .where(and(eq(documents.orgId, orgId), eq(documents.id, documentId)));
}

/* ── Counsellor lane: own-clients' docs + shared-with-me ──────────────── */

/** A counsellor's visible documents: their own clients' files, plus anything the
 * Hub shared with them (a file share, or a folder share that cascades to its docs). */
export async function listCounsellorDocumentsDb(counsellorId: string): Promise<{ own: Document[]; shared: Document[] }> {
  const db = getDb();
  const ownRows = await db.select({ d: documents }).from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(and(eq(clients.primaryCounsellorId, counsellorId), isNull(documents.deletedAt)));
  const own = ownRows.map((r) => toDocument(r.d));
  const ownIds = new Set(own.map((d) => d.id));

  const shares = await db.select().from(documentShares).where(eq(documentShares.sharedWith, counsellorId));
  const fileIds = shares.filter((s) => s.targetType === "file").map((s) => s.targetId);
  const folderIds = shares.filter((s) => s.targetType === "folder").map((s) => s.targetId);
  const sharedRows: (typeof documents.$inferSelect)[] = [];
  if (fileIds.length)
    sharedRows.push(...(await db.select().from(documents).where(and(inArray(documents.id, fileIds), isNull(documents.deletedAt)))));
  if (folderIds.length)
    sharedRows.push(...(await db.select().from(documents).where(and(inArray(documents.folderId, folderIds), isNull(documents.deletedAt)))));

  const seen = new Set<string>();
  const shared: Document[] = [];
  for (const r of sharedRows.map(toDocument)) {
    if (ownIds.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    shared.push(r);
  }
  return { own, shared };
}

/* ── Client-portal reads + request-bound upload ───────────────────────── */

/** Documents a client may see: assigned to them, client-visible, scanned clean. */
export async function listClientVisibleDocumentsDb(clientId: string): Promise<Document[]> {
  const rows = await getDb().select().from(documents).where(and(
    eq(documents.clientId, clientId),
    eq(documents.visibility, "client_visible"),
    eq(documents.scanStatus, "clean"),
    isNull(documents.deletedAt),
  ));
  return rows.map(toDocument);
}

/** A client's OPEN upload requests (the only way a client may upload). */
export async function listClientRequestsDb(clientId: string): Promise<DocumentRequest[]> {
  const rows = await getDb().select().from(documentRequests)
    .where(and(eq(documentRequests.clientId, clientId), eq(documentRequests.status, "pending")));
  return rows.map(toRequest);
}

export async function getRequestRow(requestId: string): Promise<DocumentRequest | null> {
  const [r] = await getDb().select().from(documentRequests).where(eq(documentRequests.id, requestId)).limit(1);
  return r ? toRequest(r) : null;
}

export async function getClientDocumentRow(clientId: string, documentId: string): Promise<Document | null> {
  const [r] = await getDb().select().from(documents)
    .where(and(eq(documents.clientId, clientId), eq(documents.id, documentId))).limit(1);
  return r ? toDocument(r) : null;
}

/** A client's upload against a request  visible to them, awaiting scan. */
export async function insertClientUpload(input: {
  id: string; orgId: string; clientId: string; requestId: string; name: string; contentType: string;
  storageKey: string; uploadedBy: string | null;
}): Promise<void> {
  await getDb().insert(documents).values({
    id: input.id, orgId: input.orgId, clientId: input.clientId, requestId: input.requestId, name: input.name,
    kind: "upload", visibility: "client_visible", storageProvider: "supabase", storageKey: input.storageKey,
    contentType: input.contentType, bytes: 0, sizeLabel: "…", scanStatus: "pending",
    uploadedBy: input.uploadedBy, sharedBy: "client", createdAt: new Date(),
  });
}

export async function fulfilRequestDb(requestId: string, documentId: string): Promise<void> {
  await getDb().update(documentRequests).set({ status: "fulfilled", fulfilledDocumentId: documentId })
    .where(eq(documentRequests.id, requestId));
}

/** Maintain the org's storage tally (clamped at zero). */
export async function addStorageUsage(orgId: string, deltaBytes: number): Promise<void> {
  const db = getDb();
  const [row] = await db.select().from(orgStorageUsage).where(eq(orgStorageUsage.orgId, orgId)).limit(1);
  if (row) {
    await db.update(orgStorageUsage).set({ bytesUsed: Math.max(0, row.bytesUsed + deltaBytes), updatedAt: new Date() })
      .where(eq(orgStorageUsage.orgId, orgId));
  } else {
    await db.insert(orgStorageUsage).values({ orgId, bytesUsed: Math.max(0, deltaBytes), updatedAt: new Date() });
  }
}
