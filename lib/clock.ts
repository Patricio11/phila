/**
 * The one clock. Every "now" in the app flows through here so a demo or test can
 * **freeze today** and get identical, deterministic screens (Closeout §4). Part B
 * keeps this  server requests still call `now()`; only tests/demos freeze it.
 *
 * Pages call `now()` for the request instant; pure logic and provider methods
 * take `now` as a parameter (already the case), so they stay testable.
 */
let frozen: string | null = null;

/** The current instant as an ISO string (UTC). Frozen value wins when set. */
export function now(): string {
  return frozen ?? new Date().toISOString();
}

/** Freeze "now" (tests/demos) so runs are reproducible. */
export function freezeClock(iso: string): void {
  frozen = iso;
}

/** Return to the real wall clock. */
export function unfreezeClock(): void {
  frozen = null;
}
