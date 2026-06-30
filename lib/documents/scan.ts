import "server-only";
import type { ScanStatus } from "@/lib/domain/enums";

/**
 * Virus-scan hook (Phase 18). The `scan_status` gate (pending → clean |
 * quarantined) is the contract the rest of the system relies on: a file is never
 * downloadable until `clean`. The scanner *behind* this hook is swappable — plug
 * ClamAV (self-host, in-region) or a hosted AV API here.
 *
 * No scanner is wired yet, so this returns `clean`. This is the documented
 * follow-up before public launch (docs/PHASE_18_PLAN.md §13). Until then, uploads
 * are trusted; the gate + this single chokepoint mean wiring a real scanner is a
 * one-file change with no call-site churn.
 */
export async function scanObject(key: string): Promise<ScanStatus> {
  // A real scanner inspects the object at `key`. Until one is wired, a missing key
  // is treated as a failure and everything else is trusted (returned clean).
  if (!key) return "quarantined";
  return "clean";
}
