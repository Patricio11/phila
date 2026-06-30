import "server-only";
import type { SignedUpload, StorageProvider } from "@/lib/storage/types";

/**
 * Supabase Storage backend over its REST API (no SDK dependency). The bucket is
 * **private**; the service-role key is server-only and never reaches the client.
 * Every read is a short-TTL signed URL.
 *
 * Endpoints (Storage v1):
 *  - POST   /object/upload/sign/{bucket}/{path}   → { url }   (presigned upload)
 *  - POST   /object/sign/{bucket}/{path}          → { signedURL }
 *  - DELETE /object/{bucket}/{path}
 *  - GET    /bucket/{bucket}                       (test connection)
 */
export interface SupabaseStorageConfig {
  url: string; // https://<ref>.supabase.co
  serviceKey: string; // service-role key (server-only)
  bucket: string;
}

function headers(serviceKey: string): Record<string, string> {
  return { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
}

function base(url: string): string {
  return `${url.replace(/\/$/, "")}/storage/v1`;
}

export function supabaseStorage(cfg: SupabaseStorageConfig): StorageProvider {
  const root = base(cfg.url);
  const enc = (key: string) => key.split("/").map(encodeURIComponent).join("/");

  return {
    status: "live",

    async signedUploadUrl({ key }): Promise<SignedUpload> {
      const res = await fetch(`${root}/object/upload/sign/${cfg.bucket}/${enc(key)}`, {
        method: "POST",
        headers: headers(cfg.serviceKey),
      });
      if (!res.ok) throw new Error(`Storage upload-sign failed (${res.status})`);
      const data = (await res.json()) as { url: string };
      return { uploadUrl: `${root}${data.url}`, key };
    },

    async signedDownloadUrl(key, ttlSeconds = 300): Promise<string> {
      const res = await fetch(`${root}/object/sign/${cfg.bucket}/${enc(key)}`, {
        method: "POST",
        headers: headers(cfg.serviceKey),
        body: JSON.stringify({ expiresIn: ttlSeconds }),
      });
      if (!res.ok) throw new Error(`Storage download-sign failed (${res.status})`);
      const data = (await res.json()) as { signedURL: string };
      return `${root}${data.signedURL}`;
    },

    async remove(key): Promise<void> {
      const res = await fetch(`${root}/object/${cfg.bucket}/${enc(key)}`, {
        method: "DELETE",
        headers: headers(cfg.serviceKey),
      });
      if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed (${res.status})`);
    },
  };
}

/** Test connection — true when the bucket is reachable + the key authorises. */
export async function testSupabaseConnection(cfg: SupabaseStorageConfig): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(`${base(cfg.url)}/bucket/${encodeURIComponent(cfg.bucket)}`, { headers: headers(cfg.serviceKey) });
    if (res.ok) return { ok: true };
    if (res.status === 404) return { ok: false, detail: "Bucket not found — create it (private) in Supabase." };
    if (res.status === 401 || res.status === 403) return { ok: false, detail: "Key rejected — check the service-role key." };
    return { ok: false, detail: `Supabase returned ${res.status}.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach Supabase." };
  }
}
