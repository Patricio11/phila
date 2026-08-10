import "server-only";
import { getPlatformIntegration, getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";
import { supabaseStorage, testSupabaseConnection, type SupabaseStorageConfig } from "@/lib/storage/supabase";
import { s3Storage, testS3Connection, type S3StorageConfig } from "@/lib/storage/s3";
import { StorageDormantError, type StorageProvider } from "@/lib/storage/types";
import type { StorageBackend } from "@/lib/domain/enums";

export * from "@/lib/storage/types";

/** Platform-integration key under which the super-admin stores Phila Storage config. */
export const STORAGE_KEY = "phila_storage";

/** The dormant provider  honest "off" until an admin configures + switches on. */
const dormantStorage: StorageProvider = {
  status: "off",
  async signedUploadUrl() { throw new StorageDormantError(); },
  async signedDownloadUrl() { throw new StorageDormantError(); },
  async remove() { throw new StorageDormantError(); },
};

/** Which backend the platform is set to write to right now. */
export function backendOf(creds: Record<string, string> | undefined): StorageBackend {
  return creds?.provider === "s3" ? "s3" : "supabase";
}

function s3ConfigFrom(creds: Record<string, string>): S3StorageConfig | null {
  const region = creds.s3_region?.trim();
  const bucket = creds.s3_bucket?.trim();
  const accessKeyId = creds.s3_accessKeyId?.trim();
  const secretAccessKey = creds.s3_secretAccessKey?.trim();
  if (!region || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { region, bucket, accessKeyId, secretAccessKey, endpoint: creds.s3_endpoint?.trim() || undefined };
}

function configFrom(creds: Record<string, string>): SupabaseStorageConfig | null {
  const url = creds.url?.trim();
  const serviceKey = creds.serviceKey?.trim();
  const bucket = creds.bucket?.trim();
  if (!url || !serviceKey || !bucket) return null;
  return { url, serviceKey, bucket };
}

/**
 * Resolve the storage provider. Reads the encrypted platform config and returns
 * a live backend only when configured AND switched on; otherwise the dormant
 * provider (Dormant-by-Default). The super-admin picks Supabase or S3 in
 * /admin/integrations, and both sit behind the same seam - never a bypass.
 *
 * Pass a `backend` to reach an object where it actually lives. Switching the
 * platform to S3 must not orphan what Supabase already holds, so reads follow
 * the backend recorded on the row, while writes use the active one.
 */
export async function getStorageProvider(backend?: StorageBackend): Promise<StorageProvider> {
  const it = await getPlatformIntegration(STORAGE_KEY);
  if (!it || !it.enabled) return dormantStorage;
  const want = backend ?? backendOf(it.creds);
  if (want === "s3") {
    const cfg = s3ConfigFrom(it.creds);
    return cfg ? s3Storage(cfg) : dormantStorage;
  }
  const cfg = configFrom(it.creds);
  return cfg ? supabaseStorage(cfg) : dormantStorage;
}

/** The backend new uploads are written to (recorded on the row alongside the key). */
export async function activeStorageBackend(): Promise<StorageBackend> {
  const it = await getPlatformIntegration(STORAGE_KEY);
  return backendOf(it?.creds);
}

/** Safe status for the UI (no secrets). */
export async function getStorageStatus(): Promise<{ enabled: boolean; configured: boolean }> {
  return getPlatformIntegrationStatus(STORAGE_KEY);
}

/** Test the configured (or supplied) credentials for whichever backend is chosen. */
export async function testStorageConnection(creds: Record<string, string>): Promise<{ ok: boolean; detail?: string }> {
  if (backendOf(creds) === "s3") {
    const cfg = s3ConfigFrom(creds);
    if (!cfg) return { ok: false, detail: "Enter the region, bucket, access key ID, and secret." };
    return testS3Connection(cfg);
  }
  const cfg = configFrom(creds);
  if (!cfg) return { ok: false, detail: "Enter the project URL, service-role key, and bucket." };
  return testSupabaseConnection(cfg);
}
