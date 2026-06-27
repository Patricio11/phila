"use server";

import { z } from "zod";
import { logAccess } from "@/lib/audit";

/**
 * Create an appointment (mock). Validates + audits and returns a confirmation
 * without persisting (Mock-First). Phase 11 wires the real scheduling engine
 * (room/counsellor conflict checks, recurring generation) behind this shape;
 * Phase 12 sends the confirmation. No message fires here.
 */
const input = z.object({
  orgId: z.string().min(1),
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  counsellorId: z.string().min(1),
  type: z.enum(["online", "in_person"]),
  roomId: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().positive().max(600),
  recurring: z.boolean(),
  notes: z.string().max(1000).optional(),
  sendConfirmation: z.boolean(),
});

export async function createAppointment(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please complete the appointment details." };
  const data = parsed.data;
  if (data.type === "in_person" && !data.roomId)
    return { ok: false, error: "Pick a room for an in-person session." };

  await logAccess({
    action: "admin.action",
    actor: { userId: "scheduler", platformRole: null, teamRole: "counsellor" },
    orgId: data.orgId,
    target: `appointment:new/${data.clientId}`,
    reason: data.recurring ? "create_recurring" : "create_appointment",
  });

  return { ok: true };
}
