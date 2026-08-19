"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import {
  addStorageUsage,
  assignToClientDb,
  createFolderDb,
  createRequestDb,
  currentStorageBytes,
  finalizeDocument,
  getDocumentRow,
  insertPendingDocument,
  moveItemsDb,
  renameFolderDb,
  setVisibilityDb,
  shareWithCounsellorDb,
  softDeleteItemsDb,
} from "@/db/queries/documents";
import { getStorageProvider, activeStorageBackend, objectKey } from "@/lib/storage";
import { validateUpload } from "@/lib/documents/quota";
import { orgStorageLimitBytes } from "@/db/queries/resources";
import { scanObject } from "@/lib/documents/scan";
import { notifyDocumentShared } from "@/lib/messaging/notify-document";
import { randomUUID } from "node:crypto";

/**
 * The Hub document workspace actions (Phase 18). Folders are virtual, so move /
 * assign / rename are cheap metadata writes  the basis for the smooth UI. Each
 * action is org-scoped, audited, and persists in db mode. (Real file bytes land
 * with the Supabase StorageProvider slice; these operate on the metadata layer.)
 */
type Result = { ok: true; id?: string } | { ok: false; error: string };
const isDb = () => process.env.DATA_PROVIDER === "db";

const idList = z.array(z.string().min(1)).max(500);
const ids = z.object({ documentIds: idList.default([]), folderIds: idList.default([]) });

async function audit(orgId: string, userId: string, target: string, reason: string) {
  await logAccess({
    action: "admin.action",
    actor: { userId, platformRole: null, teamRole: "org_admin" },
    orgId, target, reason,
  });
}

const createFolderInput = z.object({
  name: z.string().trim().min(1, "Give the folder a name.").max(80),
  parentId: z.string().min(1).nullable().default(null),
});
export async function createFolder(raw: z.infer<typeof createFolderInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = createFolderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the folder name." };
  let id: string | undefined;
  if (isDb())
    id = await createFolderDb(membership.orgId, { name: parsed.data.name, parentId: parsed.data.parentId, createdBy: principal.userId });
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, "create_folder");
  revalidatePath("/hub/documents");
  return { ok: true, id };
}

const renameInput = z.object({ folderId: z.string().min(1), name: z.string().trim().min(1).max(80) });
export async function renameFolder(raw: z.infer<typeof renameInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = renameInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the name." };
  if (isDb()) await renameFolderDb(membership.orgId, parsed.data.folderId, parsed.data.name);
  await audit(membership.orgId, principal.userId, `folder:${parsed.data.folderId}`, "rename_folder");
  revalidatePath("/hub/documents");
  return { ok: true };
}

const moveInput = z.object({ items: ids, targetFolderId: z.string().min(1).nullable().default(null) });
export async function moveItems(raw: z.infer<typeof moveInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = moveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Could not move those items." };
  // A folder can't be moved into itself.
  if (parsed.data.targetFolderId && parsed.data.items.folderIds.includes(parsed.data.targetFolderId))
    return { ok: false, error: "A folder can't be moved into itself." };
  if (isDb()) await moveItemsDb(membership.orgId, parsed.data.items, parsed.data.targetFolderId);
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, "move_items");
  revalidatePath("/hub/documents");
  return { ok: true };
}

const assignInput = z.object({ documentIds: idList, clientId: z.string().min(1) });
export async function assignToClient(raw: z.infer<typeof assignInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = assignInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick a client and at least one document." };
  if (isDb()) {
    await assignToClientDb(membership.orgId, parsed.data.documentIds, parsed.data.clientId);
    // Notify the client once per shared document (honest: dormant channels don't fake a send).
    for (const documentId of parsed.data.documentIds) await notifyDocumentShared(documentId);
  }
  await audit(membership.orgId, principal.userId, `client:${parsed.data.clientId}/documents`, "assign_documents");
  revalidatePath("/hub/documents");
  return { ok: true };
}

const visibilityInput = z.object({
  documentIds: idList,
  visibility: z.enum(["client_visible", "internal", "clinical"]),
});
export async function setVisibility(raw: z.infer<typeof visibilityInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = visibilityInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Could not update visibility." };
  if (isDb()) await setVisibilityDb(membership.orgId, parsed.data.documentIds, parsed.data.visibility);
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, "set_visibility");
  revalidatePath("/hub/documents");
  return { ok: true };
}

export async function deleteItems(raw: z.infer<typeof ids>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = ids.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Nothing to delete." };
  if (isDb()) await softDeleteItemsDb(membership.orgId, parsed.data);
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, "delete_items");
  revalidatePath("/hub/documents");
  return { ok: true };
}

const shareInput = z.object({
  targetType: z.enum(["file", "folder"]),
  targetId: z.string().min(1),
  /** Counsellor ids (what `document_shares.shared_with` holds), not user ids. */
  counsellorIds: z.array(z.string().min(1)).min(1, "Pick at least one counsellor."),
  /** Batch 2k - the org's instruction note (folders only) - "what to do here". */
  note: z.string().trim().max(600).optional(),
  /** Batch 2k - counsellors see only their OWN files in this folder. */
  submissionsPrivate: z.boolean().optional(),
});
export async function shareWithCounsellors(raw: z.infer<typeof shareInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = shareInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Could not share." };
  const note = parsed.data.note?.trim() || null;

  if (isDb()) {
    const {
      shareWithCounsellorDb: share, counsellorsByIdDb, ensureCounsellorFolderDb, moveItemsDb, getDocumentRow,
    } = await import("@/db/queries/documents");

    for (const counsellorId of parsed.data.counsellorIds)
      await share(membership.orgId, parsed.data.targetType, parsed.data.targetId, counsellorId, principal.userId, note);

    if (parsed.data.targetType === "folder" && (parsed.data.note !== undefined || parsed.data.submissionsPrivate !== undefined)) {
      const { setFolderShareMetaDb } = await import("@/db/queries/documents");
      await setFolderShareMetaDb(membership.orgId, [parsed.data.targetId], note, Boolean(parsed.data.submissionsPrivate));
    }

    // Batch 2r - a file or link sent to ONE counsellor moves into their folder,
    // so their things are in one place instead of scattered across the tree.
    // Sent to several, it stays put (it cannot live in two folders) and still
    // reaches each of them - their folder view gathers it either way.
    const people = await counsellorsByIdDb(membership.orgId, parsed.data.counsellorIds);
    for (const person of people.values()) {
      await ensureCounsellorFolderDb(membership.orgId, person, principal.userId);
    }
    if (parsed.data.targetType === "file" && people.size === 1) {
      const only = [...people.values()][0]!;
      const doc = await getDocumentRow(membership.orgId, parsed.data.targetId);
      // Never drag a client's or a session's file out of where it belongs.
      if (doc && !doc.clientId && !doc.sessionId) {
        const { folderId } = await ensureCounsellorFolderDb(membership.orgId, only, principal.userId);
        if (doc.folderId !== folderId) await moveItemsDb(membership.orgId, { documentIds: [doc.id], folderIds: [] }, folderId);
      }
    }

    // Notify the people it was shared with, so a share is not a silent event.
    try {
      const { createNotification } = await import("@/db/queries/notifications");
      for (const person of people.values()) {
        await createNotification({
          userId: person.userId, orgId: membership.orgId, kind: "document_shared",
          title: parsed.data.targetType === "folder" ? "A folder was shared with you" : "A document was shared with you",
          body: note ? `Instructions: ${note}` : "It is in your Documents.",
          href: "/app/documents",
        });
      }
    } catch { /* the share stands even if the bell does not ring */ }
  }
  await audit(membership.orgId, principal.userId, `${parsed.data.targetType}:${parsed.data.targetId}`, "share_with_counsellor");
  revalidatePath("/hub/documents");
  return { ok: true };
}

/**
 * Batch 3g - a folder per client, on demand: one chosen client, or everyone.
 * Idempotent, and honest about it - "already had one" is an answer, not an
 * error. Client upload requests file into these automatically.
 */
export async function ensureClientFolders(raw: { clientIds?: string[]; all?: boolean }): Promise<{ ok: true; created: number; existing: number; total: number; folderId?: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!isDb()) return { ok: false, error: "Folders need the database provider." };
  const ids = Array.isArray(raw?.clientIds) ? raw.clientIds.filter((x) => typeof x === "string" && x).slice(0, 500) : [];
  if (!raw?.all && ids.length === 0) return { ok: false, error: "Pick a client." };

  const { ensureClientFoldersDb, ensureClientFolderDb } = await import("@/db/queries/documents");
  let folderId: string | undefined;
  let res: { created: number; existing: number; total: number };
  if (!raw.all && ids.length === 1) {
    const { getDb } = await import("@/db/client");
    const { clients } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [c] = await getDb().select({ id: clients.id, name: clients.name }).from(clients)
      .where(and(eq(clients.id, ids[0]!), eq(clients.orgId, membership.orgId))).limit(1);
    if (!c) return { ok: false, error: "That client couldn't be found." };
    const one = await ensureClientFolderDb(membership.orgId, c);
    folderId = one.folderId;
    res = { created: one.created ? 1 : 0, existing: one.created ? 0 : 1, total: 1 };
  } else {
    res = await ensureClientFoldersDb(membership.orgId, raw.all ? "all" : ids);
  }
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, "ensure_client_folders");
  revalidatePath("/hub/documents");
  return { ok: true, ...res, folderId };
}

/**
 * Batch 2r - give every counsellor a folder of their own (idempotent). New
 * counsellors get one automatically; this is the button for the ones who
 * joined before, and the way to restore a folder someone deleted.
 */
export async function generateCounsellorFolders(): Promise<{ ok: true; created: number; total: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!isDb()) return { ok: false, error: "Folders need the database provider." };
  const { ensureAllCounsellorFoldersDb } = await import("@/db/queries/documents");
  const res = await ensureAllCounsellorFoldersDb(membership.orgId, principal.userId);
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, "generate_counsellor_folders");
  revalidatePath("/hub/documents");
  return { ok: true, ...res };
}

/* ── Link documents (batch 2k) - a URL instead of bytes ────────────────── */

const linkInput = z.object({
  name: z.string().trim().min(2, "Name the link.").max(160),
  url: z.string().trim().url("Enter a valid link (https://...)").max(2000),
  folderId: z.string().min(1).nullable().default(null),
});

/** Add a LINK document (e.g. a Google Doc) - opens in a new tab, no storage used. */
export async function addLinkDocument(raw: z.infer<typeof linkInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = linkInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the link." };
  if (!/^https?:\/\//i.test(parsed.data.url)) return { ok: false, error: "Links must start with http(s)://" };
  let id: string | undefined;
  if (isDb()) {
    const { addLinkDocumentDb, folderExistsDb } = await import("@/db/queries/documents");
    if (parsed.data.folderId && !(await folderExistsDb(membership.orgId, parsed.data.folderId))) {
      return { ok: false, error: "That folder no longer exists - refresh and try again." };
    }
    id = await addLinkDocumentDb(membership.orgId, {
      name: parsed.data.name, url: parsed.data.url, folderId: parsed.data.folderId,
      uploadedBy: principal.userId, sharedBy: "org",
    });
  }
  await audit(membership.orgId, principal.userId, `document:${id ?? "link"}`, "add_link_document");
  revalidatePath("/hub/documents");
  return { ok: true, id };
}

const requestInput = z.object({
  /** Who the practice is asking (batch 2z): a client, or one of its counsellors. */
  target: z.enum(["client", "counsellor"]).default("client"),
  clientId: z.string().min(1).optional(),
  counsellorId: z.string().min(1).optional(),
  title: z.string().trim().min(2, "Say what you need.").max(100),
  note: z.string().trim().max(300).optional(),
});
export async function requestDocument(raw: z.infer<typeof requestInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = requestInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the request." };
  const d = parsed.data;
  if (d.target === "client" && !d.clientId) return { ok: false, error: "Pick a client." };
  if (d.target === "counsellor" && !d.counsellorId) return { ok: false, error: "Pick a counsellor." };

  let id: string | undefined;
  if (isDb()) {
    id = await createRequestDb(membership.orgId, {
      clientId: d.target === "client" ? d.clientId : null,
      counsellorId: d.target === "counsellor" ? d.counsellorId : null,
      requestedBy: principal.userId, title: d.title, note: d.note,
    });
    // The counsellor's bell rings with what is needed; the upload lives on
    // their Documents page (their folder), not buried in email.
    if (d.target === "counsellor" && d.counsellorId) {
      try {
        const { notifyCounsellor } = await import("@/db/queries/notifications");
        await notifyCounsellor(d.counsellorId, {
          kind: "document_requested",
          title: "Your practice needs a document",
          body: `"${d.title}"${d.note ? ` - ${d.note}` : ""}. Upload it from your Documents page.`,
          href: "/app/documents",
        });
      } catch { /* the request stands even if the bell doesn't ring */ }
    }
  }
  const target = d.target === "client" ? `client:${d.clientId}` : `counsellor:${d.counsellorId}`;
  await audit(membership.orgId, principal.userId, `${target}/documents`, "request_document");
  revalidatePath("/hub/documents");
  return { ok: true, id };
}

/* ── Upload lifecycle: request → browser PUTs to storage → confirm ─────── */

const uploadInput = z.object({
  name: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(120),
  bytes: z.number().int().positive(),
  folderId: z.string().min(1).nullable().default(null),
});

/** Mint a presigned upload URL + create a pending row. The browser PUTs the bytes
 * straight to storage (never through a Server Action), then calls confirmUpload. */
export async function requestUpload(raw: z.infer<typeof uploadInput>): Promise<{ ok: true; uploadUrl: string; documentId: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = uploadInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the file." };
  const v = validateUpload({ contentType: parsed.data.contentType, bytes: parsed.data.bytes, name: parsed.data.name });
  if (!v.ok) return v;

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Phila Storage isn't switched on yet." };

  const used = await currentStorageBytes(membership.orgId);
  if (used + parsed.data.bytes > await orgStorageLimitBytes(membership.orgId))
    return { ok: false, error: "You've reached your plan's storage. Remove files or upgrade for more." };

  const documentId = `doc_${randomUUID()}`;
  const key = objectKey(membership.orgId, documentId, parsed.data.name);
  let uploadUrl: string;
  try {
    ({ uploadUrl } = await storage.signedUploadUrl({ key, contentType: parsed.data.contentType }));
  } catch {
    return { ok: false, error: "Storage rejected the upload  check the Phila Storage configuration." };
  }
  await insertPendingDocument({
    id: documentId, orgId: membership.orgId, folderId: parsed.data.folderId, name: parsed.data.name,
    contentType: parsed.data.contentType, storageKey: key, storageBackend: await activeStorageBackend(), uploadedBy: principal.userId,
  });
  await audit(membership.orgId, principal.userId, `document:${documentId}`, "request_upload");
  return { ok: true, uploadUrl, documentId };
}

const confirmInput = z.object({ documentId: z.string().min(1), bytes: z.number().int().positive() });
export async function confirmUpload(raw: z.infer<typeof confirmInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = confirmInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Could not finalise the upload." };
  const doc = await getDocumentRow(membership.orgId, parsed.data.documentId);
  if (!doc || !doc.storageKey) return { ok: false, error: "Upload not found." };

  const scan = await scanObject(doc.storageKey);
  await finalizeDocument(membership.orgId, parsed.data.documentId, parsed.data.bytes, scan);
  if (scan === "clean") await addStorageUsage(membership.orgId, parsed.data.bytes);
  await audit(membership.orgId, principal.userId, `document:${parsed.data.documentId}`, `upload_${scan}`);
  revalidatePath("/hub/documents");
  return { ok: true };
}

/** A short-TTL signed URL to open a stored file  only when scanned clean. */
export async function signDownload(raw: { documentId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const documentId = String(raw?.documentId ?? "");
  if (!documentId) return { ok: false, error: "Not found." };
  const doc = await getDocumentRow(membership.orgId, documentId);
  if (!doc || !doc.storageKey) return { ok: false, error: "That file isn't available to open." };
  if (doc.scanStatus !== "clean") return { ok: false, error: "This file is still being checked." };

  const storage = await getStorageProvider(doc.storageProvider);
  if (storage.status !== "live") return { ok: false, error: "Phila Storage isn't switched on." };
  let url: string;
  try {
    url = await storage.signedDownloadUrl(doc.storageKey);
  } catch {
    return { ok: false, error: "Could not open the file." };
  }
  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId, target: `document:${doc.id}`, reason: "download",
  });
  return { ok: true, url };
}

const renameDocInput = z.object({ documentId: z.string().min(1), name: z.string().trim().min(1, "Name the document.").max(160) });

/** Rename a document (batch 2k kebab). */
export async function renameDocument(raw: z.infer<typeof renameDocInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = renameDocInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the name." };
  if (isDb()) {
    const { renameDocumentDb } = await import("@/db/queries/documents");
    const ok = await renameDocumentDb(membership.orgId, parsed.data.documentId, parsed.data.name);
    if (!ok) return { ok: false, error: "That document couldn't be found." };
  }
  await audit(membership.orgId, principal.userId, `document:${parsed.data.documentId}`, "rename_document");
  revalidatePath("/hub/documents");
  return { ok: true };
}

/**
 * Batch 3p - share files (or a whole folder) by EMAIL: mint a tokenised public
 * download link and send it. The recipient downloads each file, or the lot as
 * one zip. Clinical documents and unscanned files never qualify; the email is
 * best-effort and the answer says honestly whether it went out.
 */
const shareEmailInput = z.object({
  documentIds: z.array(z.string().min(1)).max(100).default([]),
  folderId: z.string().min(1).nullable().default(null),
  recipientEmail: z.string().trim().email("Check the recipient's email address."),
  note: z.string().trim().max(500).optional(),
  expiresDays: z.number().int().min(1).max(90).default(14),
});
export async function createShareEmailLink(
  raw: z.infer<typeof shareEmailInput>,
): Promise<{ ok: true; url: string; count: number; emailed: boolean } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = shareEmailInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the share details." };
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };
  const d = parsed.data;

  const { createShareLinkDb } = await import("@/db/queries/share-links");
  const res = await createShareLinkDb({
    orgId: membership.orgId,
    documentIds: d.documentIds,
    folderId: d.folderId,
    recipientEmail: d.recipientEmail,
    note: d.note?.trim() || null,
    expiresDays: d.expiresDays,
    createdBy: principal.userId,
  });
  if (!res.ok) return res;

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = `${base}/share/${res.token}`;

  await audit(membership.orgId, principal.userId, `share_link:${res.id}`, "share_link_created");

  // The email itself - bounded so the dialog never hangs on a mail server.
  let emailed = false;
  try {
    const { sendEmail } = await import("@/lib/messaging/transports");
    const { railEmailHtml } = await import("@/lib/email/templates");
    const what = res.folderName
      ? `the "${res.folderName}" folder (${res.docs.length} file${res.docs.length === 1 ? "" : "s"})`
      : `${res.docs.length} file${res.docs.length === 1 ? "" : "s"}`;
    const expires = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.now() + d.expiresDays * 86_400_000));
    const subject = `${membership.orgName} shared ${res.folderName ? `"${res.folderName}"` : "files"} with you`;
    const body = `${membership.orgName} has shared ${what} with you.${d.note?.trim() ? `\n\n"${d.note.trim()}"` : ""}\n\nDownload here:\n${url}\n\nThe link works until ${expires}.`;
    const html = railEmailHtml({ subject, practiceName: membership.orgName, body, cta: { label: "Open the files", url } });
    const outcome = await Promise.race([
      sendEmail(d.recipientEmail, subject, body, membership.orgName, null, html),
      new Promise<{ status: string }>((resolve) => setTimeout(() => resolve({ status: "timeout" }), 6_000)),
    ]);
    emailed = outcome.status === "sent";
  } catch { /* the link still exists - the dialog offers Copy */ }

  return { ok: true, url, count: res.docs.length, emailed };
}

/* ── Batch 4k - recalls ─────────────────────────────────────────────────── */

/** Shared with a client by accident? Recall it: the file stays on the record, the client's portal no longer shows it. */
export async function recallFromClient(raw: { documentIds: string[] }): Promise<{ ok: true; recalled: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = idList.safeParse(raw?.documentIds);
  if (!parsed.success || parsed.data.length === 0) return { ok: false, error: "Pick at least one document." };
  let recalled = 0;
  if (isDb()) {
    const { recallFromClientDb } = await import("@/db/queries/documents");
    recalled = await recallFromClientDb(membership.orgId, parsed.data);
  }
  await audit(membership.orgId, principal.userId, `org:${membership.orgId}/documents`, `recall_client_share_${recalled}`);
  revalidatePath("/hub/documents");
  return { ok: true, recalled };
}

/** Who currently has a file / folder (for the share dialog's "Shared with" list). */
export async function getShareState(raw: { targetType: "file" | "folder"; targetId: string }): Promise<{ ok: true; shares: { counsellorId: string; name: string; note: string | null }[] } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  if (!raw?.targetId) return { ok: false, error: "Not found." };
  if (!isDb()) return { ok: true, shares: [] };
  const { listSharesForTargetDb } = await import("@/db/queries/documents");
  return { ok: true, shares: await listSharesForTargetDb(membership.orgId, raw.targetType === "folder" ? "folder" : "file", raw.targetId) };
}

/** Stop sharing a file / folder with specific counsellors. */
export async function unshareWithCounsellors(raw: { targetType: "file" | "folder"; targetId: string; counsellorIds: string[] }): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw?.targetId || !Array.isArray(raw.counsellorIds) || raw.counsellorIds.length === 0) return { ok: false, error: "Pick who to stop sharing with." };
  let removed = 0;
  if (isDb()) {
    const { unshareWithCounsellorsDb } = await import("@/db/queries/documents");
    removed = await unshareWithCounsellorsDb(membership.orgId, raw.targetType === "folder" ? "folder" : "file", raw.targetId, raw.counsellorIds.map(String));
  }
  await audit(membership.orgId, principal.userId, `${raw.targetType}:${raw.targetId}`, `unshare_counsellors_${removed}`);
  revalidatePath("/hub/documents");
  revalidatePath("/app/documents");
  return { ok: true, removed };
}

/** The org's emailed links - newest first. */
export async function listShareLinks(): Promise<{ ok: true; links: Awaited<ReturnType<typeof import("@/db/queries/share-links").listShareLinksDb>> } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  if (!isDb()) return { ok: true, links: [] };
  const { listShareLinksDb } = await import("@/db/queries/share-links");
  return { ok: true, links: await listShareLinksDb(membership.orgId) };
}

/** Recall an emailed link - the public page refuses from now on. */
export async function revokeShareLink(raw: { linkId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const linkId = String(raw?.linkId ?? "");
  if (!linkId) return { ok: false, error: "Not found." };
  if (isDb()) {
    const { revokeShareLinkDb } = await import("@/db/queries/share-links");
    if (!(await revokeShareLinkDb(membership.orgId, linkId))) return { ok: false, error: "That link wasn't found." };
  }
  await audit(membership.orgId, principal.userId, `share_link:${linkId}`, "revoke_share_link");
  revalidatePath("/hub/documents");
  return { ok: true };
}
