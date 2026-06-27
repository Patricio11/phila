"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { ROOM_STATUSES } from "@/lib/domain/enums";

/**
 * Room CRUD (mock). Validates + audits and returns success; Phase 10/11 persist
 * rooms and validate room conflicts. The schedule + utilisation are derived.
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

  await logAccess({
    action: "admin.action",
    actor: { userId: "hub", platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: parsed.data.id ? `room:${parsed.data.id}` : "room:new",
    reason: parsed.data.id ? "update_room" : "create_room",
  });
  return { ok: true };
}

const assignInput = z.object({
  roomId: z.string().min(1),
  counsellorId: z.string().min(1, "Pick a counsellor."),
  days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day."),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Assign a counsellor to a room on a recurring day/time pattern (room schedule). */
export async function saveRoomAssignment(
  raw: z.infer<typeof assignInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = assignInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the assignment." };
  if (parsed.data.end <= parsed.data.start) return { ok: false, error: "End time must be after the start." };

  await logAccess({
    action: "admin.action",
    actor: { userId: "hub", platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `room:${parsed.data.roomId}/assignment`,
    reason: "assign_counsellor",
  });
  return { ok: true };
}
