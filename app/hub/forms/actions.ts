"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { notifyFormSent } from "@/lib/messaging/notify-form";
import { getStorageProvider, objectKey } from "@/lib/storage";
import { validateUpload, storageLimitBytes } from "@/lib/documents/quota";
import { currentStorageBytes, addStorageUsage } from "@/db/queries/documents";
import { randomUUID } from "node:crypto";
import { FORM_KINDS, FORM_FIELD_TYPES, FORM_LAYOUTS, FORM_BG_TYPES, FORM_IMAGE_FITS } from "@/lib/domain/enums";

/**
 * Forms library (Phase 18.6). The Hub builds + manages the org's forms  intake
 * (drives booking) plus feedback, screening, consent, custom. Validated + audited;
 * persisted through the provider seam (real in DB mode). A radio field must offer
 * at least two choices.
 */
const field = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(2, "Each question needs a label.").max(120),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean(),
  placeholder: z.string().trim().max(160).optional().or(z.literal("")),
  help: z.string().trim().max(160).optional().or(z.literal("")),
  sensitive: z.boolean().optional(),
  options: z.array(z.string().trim().min(1)).optional(),
});

const themeInput = z
  .object({
    layout: z.enum(FORM_LAYOUTS),
    hero: z.object({
      heading: z.string().trim().max(120).optional(),
      subheading: z.string().trim().max(300).optional(),
      bullets: z.array(z.string().trim().max(120)).max(6).optional(),
      footNote: z.string().trim().max(160).optional(),
    }).default({}),
    background: z.object({
      type: z.enum(FORM_BG_TYPES),
      color: z.string().trim().max(20).optional(),
      gradientFrom: z.string().trim().max(20).optional(),
      gradientTo: z.string().trim().max(20).optional(),
      gradientAngle: z.number().int().min(0).max(360).optional(),
      imageKey: z.string().trim().max(400).optional(),
      imageFit: z.enum(FORM_IMAGE_FITS).optional(),
      overlayColor: z.string().trim().max(20).optional(),
      overlayOpacity: z.number().int().min(0).max(100).optional(),
    }),
  })
  .nullable()
  .optional();

const input = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(FORM_KINDS),
  title: z.string().trim().min(2, "Give the form a title.").max(120),
  intro: z.string().trim().max(400).optional().or(z.literal("")),
  fields: z.array(field).min(1, "Add at least one question."),
  theme: themeInput,
});

function normalise(fields: z.infer<typeof field>[]) {
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder || undefined,
    help: f.help || undefined,
    sensitive: f.sensitive,
    options: f.type === "radio" ? f.options ?? [] : undefined,
  }));
}

export async function saveForm(
  raw: z.infer<typeof input>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the questions you entered." };
  const d = parsed.data;

  for (const f of d.fields) {
    if (f.type === "radio" && (f.options ?? []).filter((o) => o.trim()).length < 2) {
      return { ok: false, error: `"${f.label}" is multiple-choice  add at least two options.` };
    }
  }

  const provider = await getDataProvider();
  const draft = { kind: d.kind, title: d.title, intro: d.intro || undefined, fields: normalise(d.fields), theme: d.theme ?? null };
  const now = clockNow();

  let id = d.id;
  if (id) {
    const res = await provider.updateForm(membership.orgId, id, draft, now);
    if (!res.ok) return { ok: false, error: "That form couldn't be found." };
  } else {
    ({ id } = await provider.createForm(membership.orgId, draft, principal.userId, now));
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `form:${id}`,
    reason: d.id ? "update_form" : "create_form",
  });
  revalidatePath("/hub/forms");
  revalidatePath(`/hub/forms/${id}`);
  return { ok: true, id };
}

export async function duplicateForm(formId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const id = String(formId ?? "");
  if (!id) return { ok: false, error: "Not found." };
  const provider = await getDataProvider();
  const res = await provider.duplicateForm(membership.orgId, id, clockNow());
  if (!res) return { ok: false, error: "That form couldn't be duplicated." };
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `form:${res.id}`, reason: "duplicate_form" });
  revalidatePath("/hub/forms");
  return { ok: true, id: res.id };
}

const sendInput = z.object({
  formId: z.string().min(1),
  clientIds: z.array(z.string().min(1)).min(1, "Pick at least one client."),
});

export async function sendForm(raw: z.infer<typeof sendInput>): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = sendInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pick at least one client." };
  const { formId, clientIds } = parsed.data;

  const provider = await getDataProvider();
  const form = await provider.getForm(membership.orgId, formId);
  if (!form) return { ok: false, error: "That form couldn't be found." };

  const res = await provider.sendFormToClients(membership.orgId, formId, clientIds, principal.userId, clockNow());
  // Best-effort notify (real transports only when DB-backed + messaging configured).
  if (process.env.DATA_PROVIDER === "db") await notifyFormSent(membership.orgId, form.title, res.assignments);

  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `form:${formId}`, reason: "send_form" });
  revalidatePath(`/hub/forms/${formId}`);
  return { ok: true, sent: res.sent };
}

/** Turn the open share link on/off (anyone with it can fill). */
export async function setFormShare(formId: string, enabled: boolean): Promise<{ ok: true; shareToken: string | null; shareEnabled: boolean } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const id = String(formId ?? "");
  if (!id) return { ok: false, error: "Not found." };
  const provider = await getDataProvider();
  const res = await provider.setFormShare(membership.orgId, id, enabled, clockNow());
  if (!res) return { ok: false, error: "That form couldn't be found." };
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `form:${id}`, reason: enabled ? "enable_form_share" : "disable_form_share" });
  revalidatePath(`/hub/forms/${id}`);
  return { ok: true, shareToken: res.shareToken, shareEnabled: res.shareEnabled };
}

/** Presign a background-image upload for the Form Designer (counts against org storage). */
const imgInput = z.object({ name: z.string().trim().min(1).max(160), contentType: z.string().trim().min(1).max(120), bytes: z.number().int().positive() });
export async function requestFormImageUpload(raw: z.infer<typeof imgInput>): Promise<{ ok: true; uploadUrl: string; key: string } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = imgInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the image." };
  if (!parsed.data.contentType.startsWith("image/")) return { ok: false, error: "Please choose an image file." };
  const v = validateUpload({ contentType: parsed.data.contentType, bytes: parsed.data.bytes, name: parsed.data.name });
  if (!v.ok) return v;

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Background images need Phila Storage switched on. You can still use a colour or gradient." };
  const used = await currentStorageBytes(membership.orgId);
  if (used + parsed.data.bytes > storageLimitBytes()) return { ok: false, error: "Your practice's storage is full  free up space or use a colour." };

  const key = objectKey(membership.orgId, `formbg_${randomUUID()}`, parsed.data.name);
  try {
    const signed = await storage.signedUploadUrl({ key, contentType: parsed.data.contentType });
    await addStorageUsage(membership.orgId, parsed.data.bytes);
    return { ok: true, uploadUrl: signed.uploadUrl, key };
  } catch {
    return { ok: false, error: "Storage rejected the upload. Please try again." };
  }
}

/** A short-TTL signed URL to preview a just-uploaded background image in the builder. */
export async function signFormImage(key: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireHub();
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Storage isn't available." };
  try {
    return { ok: true, url: await storage.signedDownloadUrl(String(key)) };
  } catch {
    return { ok: false, error: "Could not load the image." };
  }
}

export async function setFormArchived(formId: string, archived: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const id = String(formId ?? "");
  if (!id) return { ok: false, error: "Not found." };
  const provider = await getDataProvider();
  const res = await provider.setFormStatus(membership.orgId, id, archived ? "archived" : "active", clockNow());
  if (!res.ok) return { ok: false, error: "That form couldn't be updated." };
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `form:${id}`, reason: archived ? "archive_form" : "restore_form" });
  revalidatePath("/hub/forms");
  revalidatePath(`/hub/forms/${id}`);
  return { ok: true };
}
