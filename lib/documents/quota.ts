/**
 * Storage quota + human size helpers (Phase 18). Pure  unit-testable, shared by
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

/** Per-file ceiling (the practice uploads documents, not media libraries). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Allowed content types  documents + images a clinic actually handles. */
export const ALLOWED_CONTENT_TYPES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

/** Validate an upload's declared type + size before minting a presigned URL. Pure. */
export function validateUpload(input: { contentType: string; bytes: number }): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) return { ok: false, error: "That file type isn't supported." };
  if (input.bytes <= 0) return { ok: false, error: "That file looks empty." };
  if (input.bytes > MAX_FILE_BYTES) return { ok: false, error: `Files must be under ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.` };
  return { ok: true };
}

/** A calm human size label, e.g. "2.4 MB". 0 bytes (metadata-only legacy) → "". */
export function sizeLabel(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const value = n >= 10 || i === 0 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
  return `${value} ${units[i]}`;
}
