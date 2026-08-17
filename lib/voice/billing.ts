/**
 * Phase 33.5 - how a leg's seconds become billed minutes. Telephony standard:
 * round UP to the next increment (60s default), and a connected call is never
 * free (minimum one increment). Pure, unit-tested.
 */
export function billedMinutes(durationSec: number, incrementSec = 60): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const inc = incrementSec > 0 ? incrementSec : 60;
  return Math.ceil(durationSec / inc) * (inc / 60);
}
