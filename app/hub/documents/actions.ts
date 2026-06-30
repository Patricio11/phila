"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import {
  assignToClientDb,
  createFolderDb,
  createRequestDb,
  moveItemsDb,
  renameFolderDb,
  setVisibilityDb,
  shareWithCounsellorDb,
  softDeleteItemsDb,
} from "@/db/queries/documents";

/**
 * The Hub document workspace actions (Phase 18). Folders are virtual, so move /
 * assign / rename are cheap metadata writes — the basis for the smooth UI. Each
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
  if (isDb()) await assignToClientDb(membership.orgId, parsed.data.documentIds, parsed.data.clientId);
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
  counsellorUserIds: z.array(z.string().min(1)).min(1, "Pick at least one counsellor."),
});
export async function shareWithCounsellors(raw: z.infer<typeof shareInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = shareInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Could not share." };
  if (isDb())
    for (const userId of parsed.data.counsellorUserIds)
      await shareWithCounsellorDb(membership.orgId, parsed.data.targetType, parsed.data.targetId, userId, principal.userId);
  await audit(membership.orgId, principal.userId, `${parsed.data.targetType}:${parsed.data.targetId}`, "share_with_counsellor");
  revalidatePath("/hub/documents");
  return { ok: true };
}

const requestInput = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(2, "Say what you need.").max(100),
  note: z.string().trim().max(300).optional(),
});
export async function requestDocument(raw: z.infer<typeof requestInput>): Promise<Result> {
  const { principal, membership } = await requireHub();
  const parsed = requestInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the request." };
  let id: string | undefined;
  if (isDb())
    id = await createRequestDb(membership.orgId, { clientId: parsed.data.clientId, requestedBy: principal.userId, title: parsed.data.title, note: parsed.data.note });
  await audit(membership.orgId, principal.userId, `client:${parsed.data.clientId}/documents`, "request_document");
  revalidatePath("/hub/documents");
  return { ok: true, id };
}
