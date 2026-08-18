/**
 * Phase 34.2 - pure decision: should this member be told about a new message?
 * One alert per thread until they read it: `nudgedAt` is stamped when we alert
 * and cleared when they open the thread. Unit-tested; no I/O.
 */
export interface NudgeCandidate {
  /** Last time we alerted them for this thread (bell and/or external). */
  nudgedAt: Date | string | null;
  /** Their read cursor for this thread. */
  lastReadAt: Date | string | null;
}

const ms = (v: Date | string | null): number => (v == null ? 0 : v instanceof Date ? v.getTime() : new Date(v).getTime());

/** True when they have NOT been alerted since they last read the thread. */
export function shouldAlert(c: NudgeCandidate): boolean {
  if (!c.nudgedAt) return true;
  // Alerted before: only again once they've read past that alert.
  return ms(c.lastReadAt) >= ms(c.nudgedAt);
}

/** External (WhatsApp/SMS/email) goes out only when they're offline AND alerts are on. */
export function shouldNudgeExternally(opts: { online: boolean; alertsOn: boolean }): boolean {
  return !opts.online && opts.alertsOn;
}
