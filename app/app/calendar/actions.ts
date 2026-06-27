"use server";

import { z } from "zod";
import { logAccess } from "@/lib/audit";

/**
 * Reschedule (mock). In Part A this validates + audits and returns success  **no
 * notification fires** (the messaging rail is dormant; honest). Phase 11 wires
 * the real scheduling engine (conflict re-check, room validation) and Phase 12
 * the notification, behind this same shape.
 */
const input = z.object({
  appointmentId: z.string().min(1),
  newStart: z.string().min(1),
});

export async function rescheduleAppointment(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await logAccess({
    action: "admin.action",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: "reschedule",
  });
  return { ok: true };
}
