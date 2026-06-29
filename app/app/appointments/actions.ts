"use server";

import { z } from "zod";
import { logAccess } from "@/lib/audit";
import { rescheduleAppointment as persistReschedule, cancelAppointment as persistCancel } from "@/db/queries/appointments";
import { isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/db/queries/errors";

const scope = z.enum(["this", "following"]).default("this");

/**
 * Reschedule. Moves the session (or, for a recurring series with
 * `scope: "following"`, this + every later session by the same delta). The DB
 * exclusion constraints reject a move that would double-book the counsellor or
 * room (race-free). Audited. No notification fires yet (messaging is Phase 12).
 */
const rescheduleInput = z.object({
  appointmentId: z.string().min(1),
  newStart: z.string().min(1),
  scope,
});

export async function rescheduleAppointment(
  raw: z.input<typeof rescheduleInput>,
): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  const parsed = rescheduleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  let moved = 1;
  if (process.env.DATA_PROVIDER === "db") {
    try {
      moved = await persistReschedule(parsed.data.appointmentId, parsed.data.newStart, parsed.data.scope);
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
    reason: `reschedule_${parsed.data.scope}`,
  });
  return { ok: true, moved };
}

/**
 * Cancel with a reason (kept on the record). `scope: "following"` cancels this +
 * every later session in the series. Cancelling frees the slot.
 */
const cancelInput = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().max(280).default(""),
  scope,
});

export async function cancelAppointment(
  raw: z.input<typeof cancelInput>,
): Promise<{ ok: true; cancelled: number } | { ok: false; error: string }> {
  const parsed = cancelInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  let cancelled = 1;
  if (process.env.DATA_PROVIDER === "db") {
    cancelled = await persistCancel(parsed.data.appointmentId, parsed.data.reason, parsed.data.scope);
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: `cancel_${parsed.data.scope}`,
  });
  return { ok: true, cancelled };
}
