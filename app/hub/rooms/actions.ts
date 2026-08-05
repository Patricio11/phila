"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { PROVINCES, ROOM_STATUSES } from "@/lib/domain/enums";
import { saveRoom as persistRoom, saveSites as persistSites } from "@/db/queries/catalogue";

/**
 * Room CRUD — persisted in DB mode. The schedule + utilisation are derived
 * from the appointments record; conflicts are enforced at booking time.
 */
const input = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Give the room a name."),
  siteId: z.string().min(1, "Pick a site."),
  capacity: z.number().int().positive().max(50),
  equipment: z.array(z.string()),
  status: z.enum(ROOM_STATUSES),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function saveRoom(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the room details." };

  if (process.env.DATA_PROVIDER === "db") await persistRoom(membership.orgId, parsed.data);

  await logAccess({
    action: "admin.action",
    actor: { userId: "hub", platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: parsed.data.id ? `room:${parsed.data.id}` : "room:new",
    reason: parsed.data.id ? "update_room" : "create_room",
  });
  return { ok: true };
}

const sitesInput = z.object({
  sites: z
    .array(z.object({ id: z.string().min(1), name: z.string().trim().min(2, "Each site needs a name.").max(80), province: z.enum(PROVINCES) }))
    .min(1, "Keep at least one site."),
});

/**
 * Manage the org's sites/branches — persisted in DB mode. Rooms live at a site,
 * so a practice with more than one location manages them here. Validated + audited.
 */
export async function saveSites(
  raw: z.infer<typeof sitesInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = sitesInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the sites." };
  const names = parsed.data.sites.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, error: "Two sites share a name  give each a distinct one." };

  if (process.env.DATA_PROVIDER === "db") await persistSites(membership.orgId, parsed.data.sites);

  await logAccess({
    action: "admin.action",
    actor: { userId: "hub", platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/sites`,
    reason: "update_sites",
  });
  return { ok: true };
}

const assignInput = z.object({
  roomId: z.string().min(1),
  counsellorId: z.string().min(1, "Pick a counsellor."),
  days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day."),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  /** Second submit after the dialog showed the warnings — the org knows better. */
  force: z.boolean().optional(),
});

/**
 * Feedback #8 — REAL now. Assign a counsellor to a room on a recurring day/time
 * pattern (many counsellors per room; rotation is just more rows). Availability-
 * aware: the save first surfaces honest warnings (the counsellor's working
 * windows, their other rooms, this room's other claims) and only proceeds when
 * the org confirms. Audited → dashboard Activity feed.
 */
export async function saveRoomAssignment(
  raw: z.infer<typeof assignInput>,
): Promise<{ ok: true } | { ok: false; error: string } | { ok: false; warnings: string[] }> {
  const { principal, membership } = await requireHub();
  const parsed = assignInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the assignment." };
  if (parsed.data.end <= parsed.data.start) return { ok: false, error: "End time must be after the start." };
  const d = parsed.data;

  if (process.env.DATA_PROVIDER === "db") {
    const { assignmentWarningsDb, saveRoomAssignmentDb } = await import("@/db/queries/room-assignments");
    if (!d.force) {
      const warnings = await assignmentWarningsDb(membership.orgId, d);
      if (warnings.length > 0) return { ok: false, warnings };
    }
    await saveRoomAssignmentDb(membership.orgId, d);
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `room:${d.roomId}/assignment/${d.counsellorId}`,
    reason: "assign_counsellor",
  });
  revalidatePath(`/hub/rooms/${d.roomId}`);
  revalidatePath("/hub/rooms");
  return { ok: true };
}

/** Remove one assignment row. History is untouched — it lives on appointments. */
export async function removeRoomAssignment(
  raw: { assignmentId: string; roomId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw?.assignmentId) return { ok: false, error: "Invalid assignment." };

  if (process.env.DATA_PROVIDER === "db") {
    const { removeRoomAssignmentDb } = await import("@/db/queries/room-assignments");
    const removed = await removeRoomAssignmentDb(membership.orgId, raw.assignmentId);
    if (!removed) return { ok: false, error: "That assignment couldn't be found." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `room:${raw.roomId}/assignment/${raw.assignmentId}`,
    reason: "remove_room_assignment",
  });
  revalidatePath(`/hub/rooms/${raw.roomId}`);
  revalidatePath("/hub/rooms");
  return { ok: true };
}

/** Who was in this room on a date — the permanent record (feedback #8). */
export async function getRoomHistory(
  raw: { roomId: string; date: string },
): Promise<{ ok: true; history: import("@/db/queries/room-assignments").RoomHistoryDay } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  if (!raw?.roomId || !/^\d{4}-\d{2}-\d{2}$/.test(raw?.date ?? "")) return { ok: false, error: "Invalid request." };
  if (process.env.DATA_PROVIDER !== "db") {
    return { ok: true, history: { date: raw.date, counsellors: [], sessions: [], totalMinutes: 0 } };
  }
  const { getRoomHistoryDb } = await import("@/db/queries/room-assignments");
  const history = await getRoomHistoryDb(membership.orgId, raw.roomId, raw.date);
  return { ok: true, history };
}
