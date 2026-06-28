"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Intake form (mock). The Hub owns its own intake — each org's questions differ
 * (a trauma service asks different things than an EAP). Validated + audited here;
 * Phase 11 persists the form to the org and the booking flow renders it live.
 * Nothing is hardcoded: this is the single place the questions are defined.
 */
const field = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(2, "Each question needs a label.").max(120),
  type: z.enum(["text", "textarea", "tel", "email", "radio"]),
  required: z.boolean(),
  help: z.string().trim().max(160).optional().or(z.literal("")),
  sensitive: z.boolean().optional(),
  options: z.array(z.string().trim().min(1)).optional(),
});

const input = z.object({
  title: z.string().trim().min(2, "Give the form a title.").max(120),
  intro: z.string().trim().max(400).optional().or(z.literal("")),
  fields: z.array(field).min(1, "Add at least one question."),
});

export async function saveIntakeForm(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the questions you entered." };

  // A multiple-choice question must offer at least two options.
  for (const f of parsed.data.fields) {
    if (f.type === "radio" && (f.options ?? []).filter((o) => o.trim()).length < 2) {
      return { ok: false, error: `"${f.label}" is multiple-choice — add at least two options.` };
    }
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/intake_form`,
    reason: "update_intake_form",
  });
  return { ok: true };
}
