"use server";

import { z } from "zod";
import { logAccess } from "@/lib/audit";
import { rescheduleAppointment as persistReschedule } from "@/db/queries/appointments";
import { isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/db/queries/errors";

/**
 * Reschedule. Moves the session; the DB exclusion constraints reject a move that
 * would double-book the counsellor or the room (race-free). Audited. No
 * notification fires yet (the messaging rail is dormant until Phase 12).
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
  if (process.env.DATA_PROVIDER === "db") {
    try {
      await persistReschedule(parsed.data.appointmentId, parsed.data.newStart);
    } catch (e) {
      if (isSlotTakenError(e)) return { ok: false, error: SLOT_TAKEN_MESSAGE };
      throw e;
    }
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: "reschedule",
  });
  return { ok: true };
}
