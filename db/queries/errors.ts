import "server-only";

/**
 * Postgres exclusion-constraint violation (SQLSTATE 23P01) — raised by the
 * appt_no_counsellor_overlap / appt_no_room_overlap guards when a booking would
 * double-book a counsellor or a room. This is the race-free backbone of the
 * scheduling engine: even two simultaneous requests can't both win.
 */
export function isSlotTakenError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const msg = (e as { message?: string })?.message ?? "";
  return code === "23P01" || /no_counsellor_overlap|no_room_overlap|exclusion/i.test(msg);
}

export { SLOT_TAKEN_MESSAGE } from "@/lib/scheduling/messages";
