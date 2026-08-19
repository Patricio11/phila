import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { SignedUpload, StorageProvider } from "@/lib/storage/types";

/**
 * Amazon S3 (and any S3-compatible store) behind the same StorageProvider seam
 * as Supabase. The browser never sees a credential: we presign with SigV4 here
 * and hand out a short-lived URL, exactly as the Supabase backend does.
 *
 * No SDK - a presigned URL is a canonical request plus an HMAC chain, and
 * pulling in the AWS SDK for three calls would cost more than it explains.
 */

export interface S3StorageConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional S3-compatible endpoint (MinIO, Cloudflare R2). Blank = AWS. */
  endpoint?: string;
}

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
const TIMEOUT_MS = 8_000;

const sha256hex = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986 encoding. S3 wants "/" kept in the path but escaped everywhere else. */
function uriEncode(value: string, keepSlashes: boolean): string {
  const encoded = encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return keepSlashes ? encoded.replace(/%2F/g, "/") : encoded;
}

function stamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/** The virtual-hosted-style host for this bucket (or the configured endpoint's). */
function hostFor(cfg: S3StorageConfig): { host: string; protocol: string; pathPrefix: string } {
  if (cfg.endpoint) {
    const u = new URL(cfg.endpoint.includes("://") ? cfg.endpoint : `https://${cfg.endpoint}`);
    // S3-compatible endpoints are usually path-style: https://host/bucket/key
    return { host: u.host, protocol: u.protocol, pathPrefix: `/${cfg.bucket}` };
  }
  return { host: `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`, protocol: "https:", pathPrefix: "" };
}

/**
 * Presign one request as a URL (query-string auth). The payload stays unsigned,
 * which is what lets a browser PUT the bytes straight to the bucket.
 */
function presign(cfg: S3StorageConfig, method: "GET" | "PUT" | "DELETE" | "HEAD", key: string, expiresIn: number, now = new Date(), extraParams: [string, string][] = [], extraHeaders: Record<string, string> = {}): string {
  const { host, protocol, pathPrefix } = hostFor(cfg);
  const { amzDate, dateStamp } = stamps(now);
  const scope = `${dateStamp}/${cfg.region}/${SERVICE}/aws4_request`;
  const canonicalUri = `${pathPrefix}/${uriEncode(key, true)}`.replace(/^\/\//, "/");

  // Signed headers: host always; plus any header the caller will actually send
  // (e.g. Content-MD5 on a bucket-config PUT - S3 rejects a presigned request
  // that carries headers it didn't sign).
  const headerEntries = Object.entries({ host, ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v.trim()])) })
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const signedHeaders = headerEntries.map(([k]) => k).join(";");
  const canonicalHeaders = headerEntries.map(([k, v]) => `${k}:${v}\n`).join("");

  const params: [string, string][] = [
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Credential", `${cfg.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", signedHeaders],
    // Subresources such as `?cors` ride along in the canonical query (batch 4l).
    ...extraParams,
  ];
  const canonicalQuery = params
    .map(([k, v]) => [uriEncode(k, false), uriEncode(v, false)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [ALGORITHM, amzDate, scope, sha256hex(canonicalRequest)].join("\n");

  const signature = createHmac(
    "sha256",
    hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), cfg.region), SERVICE), "aws4_request"),
  ).update(stringToSign, "utf8").digest("hex");

  return `${protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function s3Storage(cfg: S3StorageConfig): StorageProvider {
  return {
    status: "live",

    async signedUploadUrl({ key }): Promise<SignedUpload> {
      // 5 minutes is plenty for a browser PUT and short enough to be safe.
      return { uploadUrl: presign(cfg, "PUT", key, 300), key };
    },

    async signedDownloadUrl(key, ttlSeconds = 300): Promise<string> {
      return presign(cfg, "GET", key, ttlSeconds);
    },

    async remove(key): Promise<void> {
      const res = await fetch(presign(cfg, "DELETE", key, 60), { method: "DELETE", signal: AbortSignal.timeout(TIMEOUT_MS) });
      // 204 on success, 404 when it was already gone - both are "it isn't there".
      if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed (${res.status})`);
    },
  };
}

/** Is the bucket reachable and does this key authorise against it? */
export async function testS3Connection(cfg: S3StorageConfig): Promise<{ ok: boolean; detail?: string }> {
  const { host, protocol, pathPrefix } = hostFor(cfg);
  const url = `${protocol}//${host}${pathPrefix || "/"}`;
  // A presigned HEAD on the bucket root: 200 = reachable + authorised.
  const signed = presign(cfg, "HEAD", "", 60).replace(/\/\?/, "?");
  try {
    const res = await fetch(signed, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return { ok: true };
    if (res.status === 403) return { ok: false, detail: "Key rejected - check the access key and its bucket policy." };
    if (res.status === 404) return { ok: false, detail: `Bucket not found at ${url} - check the name and region.` };
    return { ok: false, detail: `S3 returned ${res.status}.` };
  } catch (e) {
    const why = e instanceof Error && e.name === "TimeoutError" ? "timed out" : "could not be reached";
    return { ok: false, detail: `${host} ${why}.` };
  }
}

/* ── Batch 4l - browser uploads need the bucket's CORS rule ───────────────── */

/**
 * Why this exists: a browser uploading straight to S3 first sends a preflight
 * OPTIONS; without a CORS rule naming the app's origin the bucket answers 403
 * and every upload dies before a byte moves (exactly the "CORS error" a
 * practice saw). Phila can read and set that rule itself with the same key it
 * signs uploads with - when the key is allowed to (s3:GetBucketCors /
 * s3:PutBucketCors); otherwise we hand the admin the exact JSON to paste.
 */
export interface BucketCorsState {
  ok: boolean;
  /** Origins the bucket currently allows for PUT (empty = none / no rule). */
  allowedOrigins: string[];
  /** The key lacks s3:GetBucketCors (or the bucket isn't reachable). */
  detail?: string;
}

/** The CORS rule Phila needs: PUT/GET/HEAD from the app's origins, any header, ETag exposed. */
export function corsRuleFor(origins: string[]): { AllowedHeaders: string[]; AllowedMethods: string[]; AllowedOrigins: string[]; ExposeHeaders: string[]; MaxAgeSeconds: number }[] {
  return [{ AllowedHeaders: ["*"], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedOrigins: origins, ExposeHeaders: ["ETag"], MaxAgeSeconds: 3000 }];
}

function corsXml(origins: string[]): string {
  const rule = corsRuleFor(origins)[0]!;
  const tag = (name: string, values: string[]) => values.map((v) => `<${name}>${v}</${name}>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><CORSRule>${tag("AllowedOrigin", rule.AllowedOrigins)}${tag("AllowedMethod", rule.AllowedMethods)}${tag("AllowedHeader", rule.AllowedHeaders)}${tag("ExposeHeader", rule.ExposeHeaders)}<MaxAgeSeconds>${rule.MaxAgeSeconds}</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
}

/** Read the bucket's CORS rule (origins that may PUT). */
export async function getBucketCors(cfg: S3StorageConfig): Promise<BucketCorsState> {
  const url = presign(cfg, "GET", "", 60, new Date(), [["cors", ""]]).replace(/\/\?/, "?");
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return { ok: true, allowedOrigins: [] }; // NoSuchCORSConfiguration
    if (res.status === 403) {
      const xml = await res.text().catch(() => "");
      const msg = xml.match(/<Message>([^<]*)<\/Message>/)?.[1];
      return { ok: false, allowedOrigins: [], detail: msg ? `AWS: ${msg}` : "This access key may not read the bucket's CORS rule (s3:GetBucketCORS)." };
    }
    if (!res.ok) return { ok: false, allowedOrigins: [], detail: `S3 returned ${res.status} reading CORS.` };
    const xml = await res.text();
    // Origins from rules that allow PUT.
    const origins = new Set<string>();
    for (const rule of xml.match(/<CORSRule>[\s\S]*?<\/CORSRule>/g) ?? []) {
      if (!/<AllowedMethod>PUT<\/AllowedMethod>/.test(rule)) continue;
      for (const m of rule.matchAll(/<AllowedOrigin>([^<]*)<\/AllowedOrigin>/g)) origins.add(m[1]!.trim());
    }
    return { ok: true, allowedOrigins: Array.from(origins) };
  } catch (e) {
    return { ok: false, allowedOrigins: [], detail: e instanceof Error && e.name === "TimeoutError" ? "S3 timed out." : "S3 could not be reached." };
  }
}

/** Write Phila's CORS rule (PUT/GET/HEAD from the given origins). Returns an honest reason on refusal. */
export async function putBucketCors(cfg: S3StorageConfig, origins: string[]): Promise<{ ok: boolean; detail?: string }> {
  const body = corsXml(origins);
  const md5 = createHash("md5").update(body, "utf8").digest("base64");
  const url = presign(cfg, "PUT", "", 60, new Date(), [["cors", ""]], { "content-md5": md5 }).replace(/\/\?/, "?");
  try {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/xml", "Content-MD5": md5 }, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return { ok: true };
    if (res.status === 403) {
      const xml = await res.text().catch(() => "");
      const msg = xml.match(/<Message>([^<]*)<\/Message>/)?.[1];
      return { ok: false, detail: msg ? `AWS: ${msg}. Grant s3:PutBucketCORS to this user, or paste the rule in the AWS console.` : "This access key isn't allowed to set the bucket's CORS rule (s3:PutBucketCORS). Paste the rule in the AWS console instead." };
    }
    return { ok: false, detail: `S3 returned ${res.status} setting CORS.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error && e.name === "TimeoutError" ? "S3 timed out." : "S3 could not be reached." };
  }
}
