/**
 * The StorageProvider seam (Phase 18). Phila Storage rests files in a private,
 * in-region bucket and only ever hands out short-TTL signed URLs  never a public
 * URL (Care-Confidentiality + Data-Residency). Supabase is the live backend now;
 * S3 is a later drop-in behind this exact interface, never a bypass.
 *
 * Dormant-by-Default: until the super-admin configures + switches on Phila Storage
 * in /admin/integrations, the provider is `off` and refuses to fake an upload.
 */
export type StorageStatus = "off" | "live";

export interface SignedUpload {
  /** A short-lived URL the browser PUTs the file straight to (never via a Server Action). */
  uploadUrl: string;
  /** The object key to persist on the document row. */
  key: string;
}

export interface StorageProvider {
  readonly status: StorageStatus;
  /** Mint a presigned URL for a direct browser→storage upload. */
  signedUploadUrl(input: { key: string; contentType: string }): Promise<SignedUpload>;
  /** A time-limited URL to read a stored object (default 5 min). */
  signedDownloadUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Hard-delete an object (POPIA erasure). */
  remove(key: string): Promise<void>;
}

export class StorageDormantError extends Error {
  constructor() {
    super("Phila Storage is not switched on  configure it in Admin → Integrations.");
    this.name = "StorageDormantError";
  }
}

/** A deterministic, collision-free object key. Org-scoped path; the filename is
 * kept only as a trailing label (safe-charactered), the document id guarantees
 * uniqueness. Pure  unit-tested. */
export function objectKey(orgId: string, documentId: string, filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
  return `${orgId}/${documentId}/${safe}`;
}
