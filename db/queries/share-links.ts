import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, documentFolders, documentShareLinks, orgs } from "@/db/schema";

/**
 * Batch 3p - emailed download links. The org picks files (or a folder) and a
 * recipient; we mint an unguessable token whose public page lets them download
 * each file, or everything as one zip. Clinical documents never travel this
 * road, and only clean-scanned files (or link documents) qualify.
 */

export interface ShareableDoc {
  id: string;
  name: string;
  kind: string;
  sizeLabel: string;
  bytes: number;
  contentType: string | null;
  storageKey: string | null;
  storageProvider: string;
  externalUrl: string | null;
}

/** The org-side eligibility rule, in one place. */
function eligible(d: { visibility: string; scanStatus: string; storageKey: string | null; externalUrl: string | null; deletedAt: Date | null }): boolean {
  if (d.deletedAt) return false;
  if (d.visibility === "clinical") return false;
  if (d.externalUrl) return true;
  return Boolean(d.storageKey) && d.scanStatus === "clean";
}

export async function createShareLinkDb(input: {
  orgId: string;
  documentIds: string[];
  folderId: string | null;
  recipientEmail: string;
  note: string | null;
  expiresDays: number;
  createdBy: string;
}): Promise<{ ok: true; id: string; token: string; docs: ShareableDoc[]; folderName: string | null } | { ok: false; error: string }> {
  const db = getDb();

  let folderName: string | null = null;
  let companyId: string | null = null;
  const ids = new Set(input.documentIds);
  if (input.folderId) {
    const [f] = await db.select({ name: documentFolders.name, companyId: documentFolders.companyId }).from(documentFolders)
      .where(and(eq(documentFolders.id, input.folderId), eq(documentFolders.orgId, input.orgId))).limit(1);
    if (!f) return { ok: false, error: "That folder isn't in your practice." };
    folderName = f.name;
    companyId = f.companyId;
    const inFolder = await db.select({ id: documents.id }).from(documents)
      .where(and(eq(documents.orgId, input.orgId), eq(documents.folderId, input.folderId), isNull(documents.deletedAt)));
    for (const d of inFolder) ids.add(d.id);
  }
  if (ids.size === 0) return { ok: false, error: "Nothing selected to share." };

  const rows = await db.select().from(documents)
    .where(and(eq(documents.orgId, input.orgId), inArray(documents.id, [...ids])));
  const ok = rows.filter(eligible);
  if (ok.length === 0) return { ok: false, error: "None of the selected items can be shared - clinical documents and unscanned files stay inside Phila." };

  const id = `shl_${randomBytes(8).toString("hex")}`;
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + input.expiresDays * 86_400_000);
  await db.insert(documentShareLinks).values({
    id,
    orgId: input.orgId,
    token,
    documentIds: ok.map((d) => d.id),
    folderId: input.folderId,
    companyId,
    recipientEmail: input.recipientEmail,
    note: input.note,
    createdBy: input.createdBy,
    expiresAt,
  });

  return {
    ok: true, id, token, folderName,
    docs: ok.map((d) => ({
      id: d.id, name: d.name, kind: d.kind, sizeLabel: d.sizeLabel, bytes: d.bytes,
      contentType: d.contentType, storageKey: d.storageKey, storageProvider: d.storageProvider, externalUrl: d.externalUrl,
    })),
  };
}

export interface ShareLinkView {
  id: string;
  orgId: string;
  orgName: string;
  folderName: string | null;
  note: string | null;
  recipientEmail: string;
  expiresAt: Date;
  expired: boolean;
  revoked: boolean;
  docs: ShareableDoc[];
}

/** Resolve a public token into what the page and download routes need. */
export async function getShareForTokenDb(token: string): Promise<ShareLinkView | null> {
  if (!token || token.length < 16) return null;
  const db = getDb();
  const [link] = await db.select().from(documentShareLinks).where(eq(documentShareLinks.token, token)).limit(1);
  if (!link) return null;

  const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, link.orgId)).limit(1);
  let folderName: string | null = null;
  if (link.folderId) {
    const [f] = await db.select({ name: documentFolders.name }).from(documentFolders).where(eq(documentFolders.id, link.folderId)).limit(1);
    folderName = f?.name ?? null;
  }

  const ids = link.documentIds;
  const rows = ids.length
    ? await db.select().from(documents).where(and(eq(documents.orgId, link.orgId), inArray(documents.id, ids)))
    : [];
  // Eligibility is re-checked at READ time: a doc deleted or reclassified
  // after the email went out quietly falls off the page.
  const docs = rows.filter(eligible).map((d) => ({
    id: d.id, name: d.name, kind: d.kind, sizeLabel: d.sizeLabel, bytes: d.bytes,
    contentType: d.contentType, storageKey: d.storageKey, storageProvider: d.storageProvider, externalUrl: d.externalUrl,
  }));

  return {
    id: link.id,
    orgId: link.orgId,
    orgName: org?.name ?? "A Phila practice",
    folderName,
    note: link.note,
    recipientEmail: link.recipientEmail,
    expiresAt: link.expiresAt,
    expired: link.expiresAt.getTime() < Date.now(),
    revoked: Boolean(link.revokedAt),
    docs,
  };
}

/** Count a download against the link (per file, and once per zip). */
export async function recordShareDownloadDb(linkId: string): Promise<void> {
  const db = getDb();
  await db.update(documentShareLinks)
    .set({ downloadCount: sql`${documentShareLinks.downloadCount} + 1`, lastDownloadAt: new Date() })
    .where(eq(documentShareLinks.id, linkId));
}
