import "server-only";
import { getPlatformIntegration, getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";
import { supabaseStorage, testSupabaseConnection, type SupabaseStorageConfig } from "@/lib/storage/supabase";
import { StorageDormantError, type StorageProvider } from "@/lib/storage/types";

export * from "@/lib/storage/types";

/** Platform-integration key under which the super-admin stores Phila Storage config. */
export const STORAGE_KEY = "phila_storage";

/** The dormant provider — honest "off" until an admin configures + switches on. */
const dormantStorage: StorageProvider = {
  status: "off",
  async signedUploadUrl() { throw new StorageDormantError(); },
  async signedDownloadUrl() { throw new StorageDormantError(); },
  async remove() { throw new StorageDormantError(); },
};

function configFrom(creds: Record<string, string>): SupabaseStorageConfig | null {
  const url = creds.url?.trim();
  const serviceKey = creds.serviceKey?.trim();
  const bucket = creds.bucket?.trim();
  if (!url || !serviceKey || !bucket) return null;
  return { url, serviceKey, bucket };
}

/**
 * Resolve the active storage provider. Reads the encrypted platform config and
 * returns a live Supabase backend only when configured AND switched on; otherwise
 * the dormant provider (Dormant-by-Default). S3 slots in here behind the same seam.
 */
export async function getStorageProvider(): Promise<StorageProvider> {
  const it = await getPlatformIntegration(STORAGE_KEY);
  if (!it || !it.enabled) return dormantStorage;
  const cfg = configFrom(it.creds);
  if (!cfg) return dormantStorage;
  return supabaseStorage(cfg);
}

/** Safe status for the UI (no secrets). */
export async function getStorageStatus(): Promise<{ enabled: boolean; configured: boolean }> {
  return getPlatformIntegrationStatus(STORAGE_KEY);
}

/** Test the configured (or supplied) credentials. */
export async function testStorageConnection(creds: Record<string, string>): Promise<{ ok: boolean; detail?: string }> {
  const cfg = configFrom(creds);
  if (!cfg) return { ok: false, detail: "Enter the project URL, service-role key, and bucket." };
  return testSupabaseConnection(cfg);
}
