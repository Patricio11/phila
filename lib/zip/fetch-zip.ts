import "server-only";
import { getStorageProvider } from "@/lib/storage";
import { buildZip, zipEntryName, type ZipEntry } from "@/lib/zip/store";

/**
 * Batch 3p - pull each stored file down through a signed URL and pack the lot
 * into one STORED zip. Used by the emailed share link's "Download all" and by
 * the Documents manager's folder download. Bounded and honest: oversized files
 * are skipped by name, unreachable storage fails the whole request cleanly.
 */

const PER_FILE_CAP = 100 * 1024 * 1024; // 100 MB per file
const TOTAL_CAP = 250 * 1024 * 1024; // 250 MB per archive
const FETCH_TIMEOUT_MS = 20_000;

export interface ZipSource {
  name: string;
  bytes: number;
  storageKey: string;
  storageProvider: string;
}

export async function fetchAndZip(
  sources: ZipSource[],
): Promise<{ ok: true; zip: Uint8Array; included: number; skipped: string[] } | { ok: false; error: string }> {
  const entries: ZipEntry[] = [];
  const taken = new Set<string>();
  const skipped: string[] = [];
  let total = 0;

  for (const s of sources) {
    if (s.bytes > PER_FILE_CAP || total + s.bytes > TOTAL_CAP) { skipped.push(s.name); continue; }
    let data: Uint8Array;
    try {
      const storage = await getStorageProvider(s.storageProvider as never);
      if (storage.status !== "live") throw new Error("storage off");
      const url = await storage.signedDownloadUrl(s.storageKey);
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      data = new Uint8Array(await res.arrayBuffer());
    } catch {
      return { ok: false, error: "The practice's file storage isn't reachable right now - please try again later." };
    }
    total += data.length;
    entries.push({ name: zipEntryName(s.name, taken), data });
  }

  if (entries.length === 0) return { ok: false, error: "Nothing could be added to the zip." };
  return { ok: true, zip: buildZip(entries), included: entries.length, skipped };
}

/** A tidy download filename for the archive. */
export function zipFileName(label: string): string {
  const safe = label.replace(/[\\/:*?"<>|]/g, "_").replace(/[^ -~]/g, "_").trim() || "files";
  return `${safe}.zip`;
}
