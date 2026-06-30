/**
 * Storage quota + human size helpers (Phase 18). Pure — unit-testable, shared by
 * the mock + db providers and the document manager UI.
 *
 * Phase 18.1 uses a flat per-plan default; wiring the real `plans.storageGb`
 * entitlement is a deliberate follow-up (see docs/PHASE_18_PLAN.md §7).
 */
export const DEFAULT_STORAGE_GB = 5;
export const BYTES_PER_GB = 1024 ** 3;

/** The org's storage ceiling in bytes. (Plan-entitlement wiring is a follow-up.) */
export function storageLimitBytes(): number {
  return DEFAULT_STORAGE_GB * BYTES_PER_GB;
}

/** A calm human size label, e.g. "2.4 MB". 0 bytes (metadata-only legacy) → "—". */
export function sizeLabel(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}
