import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import {
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
import { storageLimitBytes } from "@/lib/documents/quota";

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
