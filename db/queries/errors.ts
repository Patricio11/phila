import "server-only";

/**
 * Postgres exclusion-constraint violation (SQLSTATE 23P01)  raised by the
 * appt_no_counsellor_overlap / appt_no_room_overlap guards when a booking would
 * double-book a counsellor or a room. This is the race-free backbone of the
 * scheduling engine: even two simultaneous requests can't both win.
 */
export function isSlotTakenError(e: unknown): boolean {
  // The constraints are DEFERRABLE INITIALLY DEFERRED, so inside a transaction the
  // violation surfaces at COMMIT wrapped in a driver error - walk the cause chain.
  for (let cur = e, depth = 0; cur && depth < 5; cur = (cur as { cause?: unknown }).cause, depth++) {
    const code = (cur as { code?: string })?.code;
    const msg = (cur as { message?: string })?.message ?? "";
    if (code === "23P01" || /no_counsellor_overlap|no_room_overlap|exclusion/i.test(msg)) return true;
  }
  return false;
}

/**
 * Batch 3t - the appt_no_client_overlap guard fired: the CLIENT already has a
 * session in that window. Checked before isSlotTakenError at every catch site
 * so the person booking hears the real reason.
 */
export function isClientOverlapError(e: unknown): boolean {
  for (let cur = e, depth = 0; cur && depth < 5; cur = (cur as { cause?: unknown }).cause, depth++) {
    const msg = (cur as { message?: string })?.message ?? "";
    if (/no_client_overlap/i.test(msg)) return true;
  }
  return false;
}

export const CLIENT_BUSY_MESSAGE = "This client already has a session at that time - move or cancel it first.";

export { SLOT_TAKEN_MESSAGE } from "@/lib/scheduling/messages";
