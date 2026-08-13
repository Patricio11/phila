import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import {
  clients,
  counsellors,
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
    externalUrl: r.externalUrl ?? null,
    contentType: r.contentType, bytes: r.bytes, sizeLabel: r.sizeLabel,
    scanStatus: r.scanStatus as ScanStatus, uploadedBy: r.uploadedBy,
    sharedBy: r.sharedBy as DocumentSharedBy, requestId: r.requestId,
    createdAt: r.createdAt.toISOString(),
  };
}

function toFolder(r: typeof documentFolders.$inferSelect): DocumentFolder {
  return {
    id: r.id, orgId: r.orgId, parentId: r.parentId, name: r.name,
    scope: r.scope as FolderScope, clientId: r.clientId, counsellorId: r.counsellorId ?? null,
    note: r.note ?? null, submissionsPrivate: r.submissionsPrivate,
    createdAt: r.createdAt.toISOString(),
  };
}

function toRequest(r: typeof documentRequests.$inferSelect): DocumentRequest {
  return {
    id: r.id, orgId: r.orgId, clientId: r.clientId, counsellorId: r.counsellorId ?? null, requestedBy: r.requestedBy,
    title: r.title, note: r.note, status: r.status as DocumentRequest["status"],
    dueAt: r.dueAt ? r.dueAt.toISOString() : null, fulfilledDocumentId: r.fulfilledDocumentId,
    createdAt: r.createdAt.toISOString(),
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function listOrgDocumentsDb(orgId: string): Promise<Document[]> {
  const rows = await activeDb().select().from(documents)
    .where(and(eq(documents.orgId, orgId), isNull(documents.deletedAt)));
  return rows.map(toDocument);
}

export async function listOrgFoldersDb(orgId: string): Promise<DocumentFolder[]> {
  const rows = await activeDb().select().from(documentFolders)
    .where(and(eq(documentFolders.orgId, orgId), isNull(documentFolders.deletedAt)));
  return rows.map(toFolder);
}

export async function listDocumentRequestsDb(orgId: string): Promise<DocumentRequest[]> {
  const rows = await activeDb().select().from(documentRequests).where(eq(documentRequests.orgId, orgId));
  return rows.map(toRequest);
}

export async function getStorageUsageDb(orgId: string): Promise<StorageUsage> {
  const [row] = await activeDb().select().from(orgStorageUsage)
    .where(eq(orgStorageUsage.orgId, orgId)).limit(1);
  return { orgId, bytesUsed: row?.bytesUsed ?? 0, bytesLimit: storageLimitBytes() };
}

/* ── Writes (org-scoped; the UI's tactile operations) ──────────────────── */

export async function createFolderDb(
  orgId: string,
  input: { name: string; parentId: string | null; scope?: FolderScope; clientId?: string | null; createdBy?: string | null },
): Promise<string> {
  const id = `fold_${randomUUID()}`;
  await runForOrg(orgId, () => activeDb().insert(documentFolders).values({
    id, orgId, name: input.name, parentId: input.parentId ?? null,
    scope: input.scope ?? "org", clientId: input.clientId ?? null,
    createdBy: input.createdBy ?? null, createdAt: new Date(),
  }));
  return id;
}

/** Find (or create) a folder by name under a parent - the building block for the
 *  session-attachment tree. Idempotent per (org, parent, name). */
async function findOrCreateFolder(
  db: ReturnType<typeof activeDb>, orgId: string, name: string, parentId: string | null, scope: FolderScope, clientId: string | null,
): Promise<string> {
  const [existing] = await db.select({ id: documentFolders.id }).from(documentFolders)
    .where(and(
      eq(documentFolders.orgId, orgId), eq(documentFolders.name, name), isNull(documentFolders.deletedAt),
      parentId === null ? isNull(documentFolders.parentId) : eq(documentFolders.parentId, parentId),
    )).limit(1);
  if (existing) return existing.id;
  const id = `fold_${randomUUID()}`;
  await db.insert(documentFolders).values({ id, orgId, name, parentId, scope, clientId, createdBy: "system", createdAt: new Date() });
  return id;
}

/** The leaf folder for a session's attachments: Sessions → [Client] → [Session date].
 *  So every session file is browsable in the Documents page, tidily organised. */
export async function ensureSessionFolderDb(orgId: string, clientId: string | null, clientName: string, dateLabel: string): Promise<string> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const sessions = await findOrCreateFolder(db, orgId, "Sessions", null, "org", null);
    const client = await findOrCreateFolder(db, orgId, clientName, sessions, "client", clientId);
    return findOrCreateFolder(db, orgId, dateLabel, client, "org", null);
  });
}

export async function renameFolderDb(orgId: string, folderId: string, name: string): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(documentFolders).set({ name })
    .where(and(eq(documentFolders.orgId, orgId), eq(documentFolders.id, folderId))));
}

/** Move documents and/or folders into a target folder (null = root). One metadata write. */
export async function moveItemsDb(
  orgId: string,
  items: { documentIds: string[]; folderIds: string[] },
  targetFolderId: string | null,
): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    if (items.documentIds.length)
      await db.update(documents).set({ folderId: targetFolderId })
        .where(and(eq(documents.orgId, orgId), inArray(documents.id, items.documentIds)));
    if (items.folderIds.length)
      await db.update(documentFolders).set({ parentId: targetFolderId })
        .where(and(eq(documentFolders.orgId, orgId), inArray(documentFolders.id, items.folderIds)));
  });
}

/** Assigning a document to a client puts it on their record AND makes it visible
 * to them (so the client portal shows it and the share notification is truthful). */
export async function assignToClientDb(orgId: string, documentIds: string[], clientId: string): Promise<void> {
  if (!documentIds.length) return;
  await runForOrg(orgId, () => activeDb().update(documents).set({ clientId, visibility: "client_visible" })
    .where(and(eq(documents.orgId, orgId), inArray(documents.id, documentIds))));
}

export async function setVisibilityDb(orgId: string, documentIds: string[], visibility: DocumentVisibility): Promise<void> {
  if (!documentIds.length) return;
  await runForOrg(orgId, () => activeDb().update(documents).set({ visibility })
    .where(and(eq(documents.orgId, orgId), inArray(documents.id, documentIds))));
}

export async function softDeleteItemsDb(orgId: string, items: { documentIds: string[]; folderIds: string[] }): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const now = new Date();
    if (items.documentIds.length)
      await db.update(documents).set({ deletedAt: now })
        .where(and(eq(documents.orgId, orgId), inArray(documents.id, items.documentIds)));
    if (items.folderIds.length)
      await db.update(documentFolders).set({ deletedAt: now })
        .where(and(eq(documentFolders.orgId, orgId), inArray(documentFolders.id, items.folderIds)));
  });
}

export async function shareWithCounsellorDb(
  orgId: string, targetType: ShareTargetType, targetId: string, sharedWith: string, grantedBy: string, note?: string | null,
): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    await db.insert(documentShares).values({
      id: `share_${randomUUID()}`, orgId, targetType, targetId, sharedWith, grantedBy, note: note ?? null, createdAt: new Date(),
    }).onConflictDoNothing();
    // Re-sharing with a new instruction should update it, not silently keep the old one.
    if (note !== undefined) {
      await db.update(documentShares).set({ note: note ?? null })
        .where(and(eq(documentShares.orgId, orgId), eq(documentShares.targetType, targetType), eq(documentShares.targetId, targetId), eq(documentShares.sharedWith, sharedWith)));
    }
  });
}

/* ── Counsellor folders (batch 2r) ─────────────────────────────────────────
 * Every counsellor gets one folder, named after them, living under a single
 * "Counsellors" folder. It is auto-shared with them, so anything the practice
 * puts inside is theirs to see - and anything shared TO them gathers there
 * rather than scattering across the tree.
 */

/** The parent all counsellor folders hang under. */
export async function counsellorRootFolderDb(orgId: string): Promise<string> {
  return runForOrg(orgId, () => findOrCreateFolder(activeDb(), orgId, "Counsellors", null, "org", null));
}

export interface CounsellorFolder { folderId: string; counsellorId: string; created: boolean }

/**
 * One counsellor's folder: found or created, and always shared with them.
 * Idempotent - safe to call on every counsellor creation and on demand.
 */
export async function ensureCounsellorFolderDb(
  orgId: string,
  counsellor: { id: string; userId: string; name: string },
  createdBy: string | null = "system",
): Promise<CounsellorFolder> {
  const rootId = await counsellorRootFolderDb(orgId);
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [existing] = await db.select({ id: documentFolders.id }).from(documentFolders)
      .where(and(eq(documentFolders.orgId, orgId), eq(documentFolders.counsellorId, counsellor.id), isNull(documentFolders.deletedAt)))
      .limit(1);
    let folderId = existing?.id;
    let created = false;
    if (!folderId) {
      folderId = `fold_${randomUUID()}`;
      await db.insert(documentFolders).values({
        id: folderId, orgId, name: counsellor.name, parentId: rootId, scope: "counsellor",
        clientId: null, counsellorId: counsellor.id, createdBy, createdAt: new Date(),
      });
      created = true;
    }
    // Always (re)assert the share: a folder they cannot see is not their folder.
    // `document_shares.shared_with` holds the COUNSELLOR id (what the counsellor
    // views read), not the user id - getting this wrong hides the folder.
    await db.insert(documentShares).values({
      id: `share_${randomUUID()}`, orgId, targetType: "folder", targetId: folderId,
      sharedWith: counsellor.id, grantedBy: createdBy ?? "system", createdAt: new Date(),
    }).onConflictDoNothing();
    return { folderId, counsellorId: counsellor.id, created };
  });
}

/** Give every counsellor in the practice a folder. Returns what actually changed. */
export async function ensureAllCounsellorFoldersDb(orgId: string, createdBy: string | null): Promise<{ created: number; total: number }> {
  const people = await getDb().select({ id: counsellors.id, userId: counsellors.userId, name: counsellors.name })
    .from(counsellors).where(eq(counsellors.orgId, orgId));
  let created = 0;
  for (const c of people) {
    const res = await ensureCounsellorFolderDb(orgId, c, createdBy);
    if (res.created) created++;
  }
  return { created, total: people.length };
}

/** A folder's name, for messages that should say where something landed. */
export async function folderNameDb(orgId: string, folderId: string): Promise<string | null> {
  const [row] = await getDb().select({ name: documentFolders.name }).from(documentFolders)
    .where(and(eq(documentFolders.orgId, orgId), eq(documentFolders.id, folderId))).limit(1);
  return row?.name ?? null;
}

/** The folder belonging to one counsellor, if it exists. */
export async function counsellorFolderIdDb(orgId: string, counsellorId: string): Promise<string | null> {
  const [row] = await getDb().select({ id: documentFolders.id }).from(documentFolders)
    .where(and(eq(documentFolders.orgId, orgId), eq(documentFolders.counsellorId, counsellorId), isNull(documentFolders.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

/** Counsellors by id - shares are keyed by counsellor id, notifications by user id. */
export async function counsellorsByIdDb(orgId: string, ids: string[]): Promise<Map<string, { id: string; userId: string; name: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb().select({ id: counsellors.id, userId: counsellors.userId, name: counsellors.name })
    .from(counsellors).where(and(eq(counsellors.orgId, orgId), inArray(counsellors.id, ids)));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function createRequestDb(
  orgId: string, input: { clientId?: string | null; counsellorId?: string | null; requestedBy: string; title: string; note?: string | null },
): Promise<string> {
  const id = `docreq_${randomUUID()}`;
  await runForOrg(orgId, () => activeDb().insert(documentRequests).values({
    id, orgId, clientId: input.clientId ?? null, counsellorId: input.counsellorId ?? null,
    requestedBy: input.requestedBy,
    title: input.title, note: input.note ?? null, status: "pending", createdAt: new Date(),
  }));
  return id;
}

/** Pending requests addressed to one counsellor (their to-do list). */
export async function listCounsellorRequestsDb(counsellorId: string): Promise<DocumentRequest[]> {
  const rows = await getDb().select().from(documentRequests)
    .where(and(eq(documentRequests.counsellorId, counsellorId), eq(documentRequests.status, "pending")));
  return rows.map(toRequest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  storageKey: string; storageBackend?: StorageBackend; uploadedBy: string | null;
  /** Session-attachment context (W6.2): link to the session + client, kept clinical. */
  sessionId?: string | null; clientId?: string | null; counsellorId?: string | null;
  /** The document request this upload answers (batch 2z). */
  requestId?: string | null;
  visibility?: "internal" | "clinical" | "client_visible"; sharedBy?: "org" | "counsellor" | "client";
}): Promise<void> {
  await runForOrg(input.orgId, () => activeDb().insert(documents).values({
    id: input.id, orgId: input.orgId, folderId: input.folderId, name: input.name,
    kind: "upload", visibility: input.visibility ?? "internal", storageProvider: input.storageBackend ?? "supabase", storageKey: input.storageKey,
    contentType: input.contentType, bytes: 0, sizeLabel: "…", scanStatus: "pending",
    sessionId: input.sessionId ?? null, clientId: input.clientId ?? null, counsellorId: input.counsellorId ?? null,
    requestId: input.requestId ?? null,
    uploadedBy: input.uploadedBy, sharedBy: input.sharedBy ?? "org", createdAt: new Date(),
  }));
}

/** A session's attachments (clinical), for the note editor. RLS-scoped. */
export async function listSessionAttachmentsDb(orgId: string, sessionId: string): Promise<{ id: string; name: string; sizeLabel: string; storageKey: string | null; scanStatus: string }[]> {
  return runForOrg(orgId, async () => {
    const rows = await activeDb().select({ id: documents.id, name: documents.name, sizeLabel: documents.sizeLabel, storageKey: documents.storageKey, scanStatus: documents.scanStatus })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.sessionId, sessionId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt));
    return rows;
  });
}

export async function finalizeDocument(orgId: string, documentId: string, bytes: number, scanStatus: ScanStatus): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(documents).set({ bytes, sizeLabel: sizeLabel(bytes), scanStatus })
    .where(and(eq(documents.orgId, orgId), eq(documents.id, documentId))));
}

/* ── Counsellor lane: own-clients' docs + shared-with-me ──────────────── */

/** A counsellor's visible documents: their own clients' files, plus anything the
 * Hub shared with them (a file share, or a folder share that cascades to its docs). */
export interface SharedFolderView {
  folder: DocumentFolder;
  docs: Document[];
  /** Batch 2r - true for the counsellor's OWN folder (their gathering place). */
  mine?: boolean;
}

/** Batch 2r - a file or link shared straight at a counsellor, with its note. */
export interface SharedDocView {
  doc: Document;
  note: string | null;
}

/**
 * What a counsellor may see (batch 2k): their own clients' documents, files
 * shared directly with them, and shared FOLDERS - each with the org's note. A
 * folder marked `submissionsPrivate` shows the org's source material plus ONLY
 * this counsellor's own submissions - never another counsellor's.
 */
export async function listCounsellorDocumentsDb(counsellorId: string): Promise<{ own: Document[]; shared: Document[]; sharedNotes: Record<string, string>; sharedFolders: SharedFolderView[] }> {
  const db = getDb();
  const ownRows = await db.select({ d: documents }).from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(and(eq(clients.primaryCounsellorId, counsellorId), isNull(documents.deletedAt)));
  const own = ownRows.map((r) => toDocument(r.d));
  const ownIds = new Set(own.map((d) => d.id));

  const shares = await db.select().from(documentShares).where(eq(documentShares.sharedWith, counsellorId));
  const fileIds = shares.filter((s) => s.targetType === "file").map((s) => s.targetId);
  const folderIds = shares.filter((s) => s.targetType === "folder").map((s) => s.targetId);

  // Direct file shares.
  const fileRows = fileIds.length
    ? await db.select().from(documents).where(and(inArray(documents.id, fileIds), isNull(documents.deletedAt)))
    : [];
  const seen = new Set<string>();
  const shared: Document[] = [];
  for (const r of fileRows.map(toDocument)) {
    if (ownIds.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    shared.push(r);
  }
  // The instruction that travelled with each file/link share (batch 2r).
  const sharedNotes: Record<string, string> = {};
  for (const sh of shares) {
    if (sh.targetType === "file" && sh.note) sharedNotes[sh.targetId] = sh.note;
  }

  // Shared folders - each with its note; private folders filter to org material
  // + this counsellor's own submissions.
  const sharedFolders: SharedFolderView[] = [];
  if (folderIds.length) {
    const folderRows = await db.select().from(documentFolders)
      .where(and(inArray(documentFolders.id, folderIds), isNull(documentFolders.deletedAt)));
    const docRows = await db.select().from(documents)
      .where(and(inArray(documents.folderId, folderIds), isNull(documents.deletedAt)));
    for (const f of folderRows) {
      const all = docRows.filter((d) => d.folderId === f.id).map(toDocument);
      const docs = f.submissionsPrivate
        ? all.filter((d) => d.sharedBy === "org" || d.uploadedBy === counsellorId)
        : all;
      sharedFolders.push({
        folder: toFolder(f),
        docs: docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        mine: f.counsellorId === counsellorId,
      });
    }
    // Their own folder leads - it is where their work gathers.
    sharedFolders.sort((a, b) => Number(Boolean(b.mine)) - Number(Boolean(a.mine)) || a.folder.name.localeCompare(b.folder.name));
  }

  // Batch 2r - a file that lives in a folder they can see is shown there, once.
  // Sharing it directly AND placing it in their folder used to list it twice.
  const inFolders = new Set(sharedFolders.flatMap((f) => f.docs.map((d) => d.id)));
  const dedupedShared = shared.filter((d) => !inFolders.has(d.id));

  return { own, shared: dedupedShared, sharedNotes, sharedFolders };
}

/* ── Link documents + folder share meta (batch 2k) ─────────────────────── */

/** Add a LINK document (e.g. a Google Doc URL) - no bytes, no quota. */
export async function addLinkDocumentDb(orgId: string, input: {
  name: string; url: string; folderId: string | null;
  uploadedBy: string; sharedBy: DocumentSharedBy; counsellorId?: string | null;
}): Promise<string> {
  const id = `doc_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await getDb().insert(documents).values({
    id, orgId, folderId: input.folderId, clientId: null,
    counsellorId: input.counsellorId ?? null, sessionId: null,
    name: input.name, kind: "resource", visibility: "internal",
    storageProvider: "supabase", storageKey: null, externalUrl: input.url,
    contentType: "text/uri-list", bytes: 0, sizeLabel: "link",
    scanStatus: "clean", uploadedBy: input.uploadedBy, sharedBy: input.sharedBy,
    requestId: null, createdAt: new Date(),
  });
  return id;
}

/** The org's note + submission privacy on a shared folder. */
export async function setFolderShareMetaDb(orgId: string, folderIds: string[], note: string | null, submissionsPrivate: boolean): Promise<void> {
  if (!folderIds.length) return;
  await runForOrg(orgId, async () => {
    await activeDb().update(documentFolders)
      .set({ note, submissionsPrivate })
      .where(and(inArray(documentFolders.id, folderIds), eq(documentFolders.orgId, orgId)));
  });
}

/** Does this folder exist in this org? (Guards link-adds against stale ids.) */
export async function folderExistsDb(orgId: string, folderId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: documentFolders.id }).from(documentFolders)
    .where(and(eq(documentFolders.id, folderId), eq(documentFolders.orgId, orgId), isNull(documentFolders.deletedAt))).limit(1);
  return Boolean(row);
}

/** Is this folder shared with this counsellor? (Guards counsellor link-adds.) */
export async function folderSharedWithDb(orgId: string, folderId: string, counsellorId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: documentShares.id }).from(documentShares)
    .where(and(eq(documentShares.orgId, orgId), eq(documentShares.targetType, "folder"),
      eq(documentShares.targetId, folderId), eq(documentShares.sharedWith, counsellorId))).limit(1);
  return Boolean(row);
}

/* ── Client-portal reads + request-bound upload ───────────────────────── */

/** Documents a client may see: assigned to them, client-visible, scanned clean. */
export async function listClientVisibleDocumentsDb(clientId: string): Promise<Document[]> {
  const rows = await activeDb().select().from(documents).where(and(
    eq(documents.clientId, clientId),
    eq(documents.visibility, "client_visible"),
    eq(documents.scanStatus, "clean"),
    isNull(documents.deletedAt),
  ));
  return rows.map(toDocument);
}

/** A client's OPEN upload requests (the only way a client may upload). */
export async function listClientRequestsDb(clientId: string): Promise<DocumentRequest[]> {
  const rows = await activeDb().select().from(documentRequests)
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
  storageKey: string; storageBackend?: StorageBackend; uploadedBy: string | null;
}): Promise<void> {
  await getDb().insert(documents).values({
    id: input.id, orgId: input.orgId, clientId: input.clientId, requestId: input.requestId, name: input.name,
    kind: "upload", visibility: "client_visible", storageProvider: input.storageBackend ?? "supabase", storageKey: input.storageKey,
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

/** Rename a document (org-managed; batch 2k kebab). */
export async function renameDocumentDb(orgId: string, documentId: string, name: string): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(documents).set({ name })
      .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
      .returning({ id: documents.id });
    return res.length > 0;
  });
}

/** A counsellor edits their OWN link document (name + url). */
export async function updateOwnLinkDb(orgId: string, documentId: string, counsellorId: string, input: { name: string; url: string }): Promise<boolean> {
  const res = await getDb().update(documents)
    .set({ name: input.name, externalUrl: input.url })
    .where(and(
      eq(documents.id, documentId), eq(documents.orgId, orgId),
      eq(documents.uploadedBy, counsellorId), isNull(documents.deletedAt),
    ))
    .returning({ id: documents.id });
  return res.length > 0;
}

/** A counsellor removes their OWN link document (soft delete; links only). */
export async function deleteOwnLinkDb(orgId: string, documentId: string, counsellorId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: documents.id, externalUrl: documents.externalUrl, uploadedBy: documents.uploadedBy })
    .from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, orgId), isNull(documents.deletedAt))).limit(1);
  if (!row || row.uploadedBy !== counsellorId || !row.externalUrl) return false;
  await getDb().update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, documentId));
  return true;
}
