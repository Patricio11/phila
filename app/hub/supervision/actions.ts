"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Supervision classrooms (batch 2) - org-managed: create a class per supervisor
 * (supervisees auto-rostered), adjust the roster. Streams live in /app.
 */
const createInput = z.object({
  name: z.string().trim().min(2, "Give the classroom a name.").max(80),
  supervisorId: z.string().min(1, "Pick the supervisor."),
  description: z.string().trim().max(400).optional(),
});

export async function createClassroom(
  raw: z.infer<typeof createInput>,
): Promise<{ ok: true; members: number; code: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  let created = { code: "", members: 0 };
  if (isDb()) {
    const { createClassDb } = await import("@/db/queries/classrooms");
    const res = await createClassDb(membership.orgId, { name: parsed.data.name, description: parsed.data.description ?? null, supervisorId: parsed.data.supervisorId });
    created = { code: res.code, members: res.members };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `classroom:new/${parsed.data.supervisorId}`,
    reason: "create_classroom",
  });
  revalidatePath("/hub/supervision");
  return { ok: true, ...created };
}

/** Add or remove a classroom member (roster stays org-controlled). */
export async function setClassroomMember(
  raw: { classId: string; counsellorId: string; present: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw?.classId || !raw?.counsellorId) return { ok: false, error: "Invalid request." };

  if (isDb()) {
    const { setClassMemberDb } = await import("@/db/queries/classrooms");
    const ok = await setClassMemberDb(membership.orgId, raw.classId, raw.counsellorId, Boolean(raw.present));
    if (!ok) return { ok: false, error: "That classroom couldn't be found." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `classroom:${raw.classId}/member/${raw.counsellorId}`,
    reason: raw.present ? "add_classroom_member" : "remove_classroom_member",
  });
  revalidatePath("/hub/supervision");
  return { ok: true };
}

const editClassInput = z.object({
  classId: z.string().min(1),
  name: z.string().trim().min(2, "Give the classroom a name.").max(80),
  supervisorId: z.string().min(1, "Pick the supervisor."),
  description: z.string().trim().max(400).optional(),
});

/** Edit a classroom (batch 2d) - fix the name/description, or hand it to another supervisor. */
export async function updateClassroom(
  raw: z.infer<typeof editClassInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = editClassInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  if (isDb()) {
    const { updateClassDb } = await import("@/db/queries/classrooms");
    const ok = await updateClassDb(membership.orgId, parsed.data.classId, {
      name: parsed.data.name, description: parsed.data.description || null, supervisorId: parsed.data.supervisorId,
    });
    if (!ok) return { ok: false, error: "That classroom couldn't be found." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `classroom:${parsed.data.classId}`,
    reason: "update_classroom",
  });
  revalidatePath("/hub/supervision");
  return { ok: true };
}
