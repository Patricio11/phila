"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { FORM_KINDS, FORM_FIELD_TYPES } from "@/lib/domain/enums";

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

const input = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(FORM_KINDS),
  title: z.string().trim().min(2, "Give the form a title.").max(120),
  intro: z.string().trim().max(400).optional().or(z.literal("")),
  fields: z.array(field).min(1, "Add at least one question."),
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
  const draft = { kind: d.kind, title: d.title, intro: d.intro || undefined, fields: normalise(d.fields) };
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
