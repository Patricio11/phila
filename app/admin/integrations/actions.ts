"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { getPlatformIntegration, savePlatformIntegration } from "@/db/queries/platform-integrations";
import { testPaystackKey } from "@/lib/payments/paystack";
import { testLivekit } from "@/lib/video/livekit";
import { STORAGE_KEY, testStorageConnection } from "@/lib/storage";

/**
 * Super-admin configures Phila's own payment gateway (Paystack) for credit + plan
 * billing (Phase 15). The key is encrypted at rest and switched on here  never an
 * env var. A blank key field keeps the stored key (so you can toggle without
 * re-pasting). "Test connection" validates a key against Paystack before saving.
 */
const input = z.object({ secretKey: z.string().trim().default(""), enabled: z.boolean() });

async function resolveKey(provided: string): Promise<string> {
  if (provided) return provided;
  const existing = await getPlatformIntegration("paystack");
  return existing?.creds.secretKey ?? "";
}

export async function savePaystackConfig(raw: z.infer<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const secretKey = await resolveKey(parsed.data.secretKey);
  if (parsed.data.enabled && !secretKey) return { ok: false, error: "Add a secret key before switching it on." };

  await savePlatformIntegration("paystack", { secretKey }, parsed.data.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:paystack", reason: parsed.data.enabled ? "enable_paystack" : "save_paystack" });
  return { ok: true };
}

export async function testPaystackConnection(raw: { secretKey: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const key = await resolveKey((raw.secretKey ?? "").trim());
  return testPaystackKey(key);
}

/**
 * Video gateway (LiveKit)  Demo (self-host) or Live (Cloud). Configured + switched on
 * here; key/secret encrypted at rest. A blank secret keeps the stored one.
 */
const lkCreds = z.object({
  wsUrl: z.string().trim().max(200).default(""),
  apiKey: z.string().trim().max(200).default(""),
  apiSecret: z.string().trim().max(400).default(""),
});
const lkInput = z.object({
  provider: z.enum(["selfhosted", "cloud"]),
  sh: lkCreds, // Phila self-hosted (Docker)
  cloud: lkCreds, // LiveKit Cloud
  enabled: z.boolean(),
});

async function existingLkCreds(): Promise<Record<string, string>> {
  return (await getPlatformIntegration("livekit"))?.creds ?? {};
}

/** Blank secret keeps the stored one  resolved per provider (incl. legacy flat key). */
function keepSecret(provided: string, provider: "selfhosted" | "cloud", ex: Record<string, string>): string {
  if (provided) return provided;
  const perProvider = provider === "cloud" ? ex.cloud_apiSecret : ex.sh_apiSecret;
  const legacyMatches = (ex.mode === "live" ? "cloud" : "selfhosted") === provider;
  return perProvider || (legacyMatches ? ex.apiSecret : "") || "";
}

export async function saveLivekitConfig(raw: z.infer<typeof lkInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = lkInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const d = parsed.data;
  const ex = await existingLkCreds();

  const creds: Record<string, string> = {
    provider: d.provider,
    sh_wsUrl: d.sh.wsUrl, sh_apiKey: d.sh.apiKey, sh_apiSecret: keepSecret(d.sh.apiSecret, "selfhosted", ex),
    cloud_wsUrl: d.cloud.wsUrl, cloud_apiKey: d.cloud.apiKey, cloud_apiSecret: keepSecret(d.cloud.apiSecret, "cloud", ex),
  };
  const active = d.provider === "cloud"
    ? { wsUrl: creds.cloud_wsUrl, apiKey: creds.cloud_apiKey, apiSecret: creds.cloud_apiSecret }
    : { wsUrl: creds.sh_wsUrl, apiKey: creds.sh_apiKey, apiSecret: creds.sh_apiSecret };
  if (d.enabled && (!active.wsUrl || !active.apiKey || !active.apiSecret)) {
    return { ok: false, error: `Add the URL, key, and secret for ${d.provider === "cloud" ? "LiveKit Cloud" : "the self-hosted server"} before switching it on.` };
  }

  await savePlatformIntegration("livekit", creds, d.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:livekit", reason: d.enabled ? `enable_livekit_${d.provider}` : "save_livekit" });
  return { ok: true };
}

export async function testLivekitConnection(raw: { provider?: "selfhosted" | "cloud"; wsUrl: string; apiKey: string; apiSecret: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const provider = raw.provider ?? "selfhosted";
  const apiSecret = keepSecret((raw.apiSecret ?? "").trim(), provider, await existingLkCreds());
  return testLivekit((raw.wsUrl ?? "").trim(), (raw.apiKey ?? "").trim(), apiSecret);
}

/**
 * Phila Storage (Phase 18)  the platform file store. Super-admin enters the
 * Supabase project URL + service-role key + (private) bucket, tests, and switches
 * on. The key is encrypted at rest; a blank key field keeps the stored one. Until
 * switched on, document uploads stay honestly dormant (Dormant-by-Default).
 */
const storageInput = z.object({
  /** Batch 2o - which backend holds the bytes from now on. */
  provider: z.enum(["supabase", "s3"]).default("supabase"),
  url: z.string().trim().max(200),
  serviceKey: z.string().trim().default(""),
  bucket: z.string().trim().max(100),
  /** Public anon key  used by the browser for Supabase Realtime (chat live + presence). */
  anonKey: z.string().trim().max(400).default(""),
  /** Supabase JWT secret  signs scoped realtime tokens for private channels (opt-in). */
  jwtSecret: z.string().trim().max(400).default(""),
  /** Enable RLS-authorized private realtime channels (requires the setup SQL). */
  realtimePrivate: z.boolean().default(false),
  /* Amazon S3 (or any S3-compatible store). Blank secret keeps the stored one. */
  s3Region: z.string().trim().max(40).default(""),
  s3Bucket: z.string().trim().max(120).default(""),
  s3AccessKeyId: z.string().trim().max(200).default(""),
  s3SecretAccessKey: z.string().trim().max(400).default(""),
  s3Endpoint: z.string().trim().max(200).default(""),
  enabled: z.boolean(),
});

/** Merge submitted S3 fields over what is stored (blank secret = keep). */
async function resolveS3Creds(raw: { s3Region?: string; s3Bucket?: string; s3AccessKeyId?: string; s3SecretAccessKey?: string; s3Endpoint?: string }) {
  const existing = await getPlatformIntegration(STORAGE_KEY);
  return {
    s3_region: (raw.s3Region ?? "").trim() || existing?.creds.s3_region || "",
    s3_bucket: (raw.s3Bucket ?? "").trim() || existing?.creds.s3_bucket || "",
    s3_accessKeyId: (raw.s3AccessKeyId ?? "").trim() || existing?.creds.s3_accessKeyId || "",
    s3_secretAccessKey: (raw.s3SecretAccessKey ?? "").trim() || existing?.creds.s3_secretAccessKey || "",
    s3_endpoint: (raw.s3Endpoint ?? "").trim() || existing?.creds.s3_endpoint || "",
  };
}

async function resolveStorageCreds(raw: { url?: string; serviceKey?: string; bucket?: string }): Promise<{ url: string; serviceKey: string; bucket: string }> {
  const existing = await getPlatformIntegration(STORAGE_KEY);
  return {
    url: (raw.url ?? "").trim() || existing?.creds.url || "",
    serviceKey: (raw.serviceKey ?? "").trim() || existing?.creds.serviceKey || "",
    bucket: (raw.bucket ?? "").trim() || existing?.creds.bucket || "",
  };
}

export async function saveStorageConfig(raw: z.infer<typeof storageInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = storageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const d = parsed.data;
  const creds = await resolveStorageCreds({ url: d.url, serviceKey: d.serviceKey, bucket: d.bucket });
  const s3 = await resolveS3Creds(d);
  const existing = await getPlatformIntegration(STORAGE_KEY);
  const anonKey = d.anonKey.trim() || existing?.creds.anonKey || "";
  const jwtSecret = d.jwtSecret.trim() || existing?.creds.jwtSecret || "";

  // Only the backend being switched ON has to be complete. The other keeps its
  // stored config, so a practice can move back without re-typing anything.
  if (d.enabled && d.provider === "s3" && (!s3.s3_region || !s3.s3_bucket || !s3.s3_accessKeyId || !s3.s3_secretAccessKey))
    return { ok: false, error: "Add the region, bucket, access key ID, and secret before switching S3 on." };
  if (d.enabled && d.provider === "supabase" && (!creds.url || !creds.serviceKey || !creds.bucket))
    return { ok: false, error: "Add the project URL, service-role key, and bucket before switching it on." };
  if (d.realtimePrivate && !jwtSecret)
    return { ok: false, error: "Add the Supabase JWT secret before enabling private channels." };

  await savePlatformIntegration(
    STORAGE_KEY,
    { ...creds, ...s3, provider: d.provider, anonKey, jwtSecret, realtimePrivate: d.realtimePrivate ? "true" : "false" },
    d.enabled,
  );
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:phila_storage", reason: d.enabled ? "enable_storage" : "save_storage" });
  return { ok: true };
}

export async function testStorageConnectionAction(raw: {
  provider?: "supabase" | "s3"; url?: string; serviceKey?: string; bucket?: string;
  s3Region?: string; s3Bucket?: string; s3AccessKeyId?: string; s3SecretAccessKey?: string; s3Endpoint?: string;
}): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const provider = raw?.provider === "s3" ? "s3" : "supabase";
  const creds = provider === "s3"
    ? { provider, ...(await resolveS3Creds(raw)) }
    : { provider, ...(await resolveStorageCreds(raw)) };
  const res = await testStorageConnection(creds);
  return { ok: res.ok, detail: res.detail ?? (res.ok ? "Bucket reachable." : "Could not connect.") };
}

/**
 * Phila SMS (BulkSMS)  the platform SMS sender orgs buy credits against. Token
 * ID + secret encrypted at rest; a blank field keeps the stored one.
 */
const smsInput = z.object({ tokenId: z.string().trim().default(""), tokenSecret: z.string().trim().default(""), enabled: z.boolean() });
async function resolveSmsCreds(raw: { tokenId?: string; tokenSecret?: string }): Promise<{ tokenId: string; tokenSecret: string }> {
  const existing = await getPlatformIntegration("bulksms");
  return { tokenId: (raw.tokenId ?? "").trim() || existing?.creds.tokenId || "", tokenSecret: (raw.tokenSecret ?? "").trim() || existing?.creds.tokenSecret || "" };
}
export async function saveBulkSmsConfig(raw: z.infer<typeof smsInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = smsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const creds = await resolveSmsCreds(parsed.data);
  if (parsed.data.enabled && (!creds.tokenId || !creds.tokenSecret)) return { ok: false, error: "Add the BulkSMS token ID + secret before switching it on." };
  await savePlatformIntegration("bulksms", creds, parsed.data.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:bulksms", reason: parsed.data.enabled ? "enable_bulksms" : "save_bulksms" });
  return { ok: true };
}
export async function testBulkSmsConnection(raw: { tokenId: string; tokenSecret: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const creds = await resolveSmsCreds(raw);
  if (!creds.tokenId || !creds.tokenSecret) return { ok: false, detail: "Enter the token ID and secret." };
  try {
    const auth = Buffer.from(`${creds.tokenId}:${creds.tokenSecret}`).toString("base64");
    const res = await fetch("https://api.bulksms.com/v1/profile", { headers: { Authorization: `Basic ${auth}` } });
    if (res.ok) return { ok: true, detail: "Connected to BulkSMS." };
    if (res.status === 401) return { ok: false, detail: "Token rejected  check the ID + secret." };
    return { ok: false, detail: `BulkSMS returned ${res.status}.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach BulkSMS." };
  }
}

/**
 * Phila email (Resend)  sends from Phila's verified domain with the practice as
 * display name + reply-to. API key encrypted at rest; a blank key keeps the stored one.
 */
const emailInput = z.object({ apiKey: z.string().trim().default(""), from: z.string().trim().max(200), enabled: z.boolean() });
async function resolveResendCreds(raw: { apiKey?: string; from?: string }): Promise<{ apiKey: string; from: string }> {
  const existing = await getPlatformIntegration("resend");
  return { apiKey: (raw.apiKey ?? "").trim() || existing?.creds.apiKey || "", from: (raw.from ?? "").trim() || existing?.creds.from || "" };
}
export async function saveResendConfig(raw: z.infer<typeof emailInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = emailInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const creds = await resolveResendCreds({ apiKey: parsed.data.apiKey, from: parsed.data.from });
  if (parsed.data.enabled && (!creds.apiKey || !creds.from)) return { ok: false, error: "Add the Resend API key + from-address before switching it on." };
  await savePlatformIntegration("resend", creds, parsed.data.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:resend", reason: parsed.data.enabled ? "enable_resend" : "save_resend" });
  return { ok: true };
}
export async function testResendConnection(raw: { apiKey: string; from: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const creds = await resolveResendCreds(raw);
  if (!creds.apiKey) return { ok: false, detail: "Enter the Resend API key." };
  try {
    const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${creds.apiKey}` } });
    if (res.ok) return { ok: true, detail: "Connected to Resend." };
    if (res.status === 401) return { ok: false, detail: "API key rejected." };
    return { ok: false, detail: `Resend returned ${res.status}.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach Resend." };
  }
}

/**
 * Phase 33.2 - the VoicePhila rail (Twilio first, provider-swappable).
 * Mock mode needs no carrier credentials; live mode requires the full set.
 */
const voiceInput = z.object({
  accountSid: z.string().trim().max(64).default(""),
  authToken: z.string().trim().max(128).default(""),
  callerNumber: z.string().trim().max(20).default(""),
  mode: z.enum(["off", "mock", "live"]),
});
export async function saveVoiceConfig(raw: z.infer<typeof voiceInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = voiceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the voice settings." };
  const d = parsed.data;

  const existing = (await getPlatformIntegration("voice"))?.creds ?? {};
  const creds: Record<string, string> = {
    provider: "twilio",
    mode: d.mode,
    accountSid: d.accountSid || existing.accountSid || "",
    authToken: d.authToken || existing.authToken || (d.mode === "mock" ? existing.authToken || "mock-secret" : ""),
    callerNumber: d.callerNumber || existing.callerNumber || "",
  };
  if (d.mode === "live" && (!creds.accountSid || !creds.authToken || !creds.callerNumber)) {
    return { ok: false, error: "Live mode needs the Account SID, auth token and the shared caller number." };
  }
  await savePlatformIntegration("voice", creds, d.mode !== "off");
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: "integration:voice",
    reason: `voice_${d.mode}`,
  });
  revalidatePath("/admin/integrations");
  return { ok: true };
}

export async function testVoiceConnection(raw: { accountSid: string; authToken: string; mode: "off" | "mock" | "live" }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  if (raw.mode === "mock") return { ok: true, detail: "Mock mode - calls simulate instantly, nothing dials out." };
  const existing = (await getPlatformIntegration("voice"))?.creds ?? {};
  const sid = raw.accountSid || existing.accountSid || "";
  const token = raw.authToken || existing.authToken || "";
  if (!sid || !token) return { ok: false, detail: "Enter the Twilio Account SID and auth token first." };
  const { twilioAdapter } = await import("@/lib/voice/twilio");
  return twilioAdapter({ provider: "twilio", mode: "live", accountSid: sid, authToken: token, callerNumber: "" }).testConnection();
}

/* ── Batch 4l - browser uploads need the S3 bucket's CORS rule ─────────────── */

/** The origins a browser will upload from: the app's URL (+ localhost for development). */
function appOrigins(): string[] {
  const out = new Set<string>();
  const base = process.env.BETTER_AUTH_URL ?? "";
  try { if (base) out.add(new URL(base).origin); } catch { /* ignore */ }
  out.add("http://localhost:3000");
  return Array.from(out);
}

export async function getStorageCorsState(): Promise<{ ok: boolean; provider: "supabase" | "s3"; required: string[]; allowed: string[]; satisfied: boolean; detail?: string; rule: unknown }> {
  await requireSuperAdmin();
  const it = await getPlatformIntegration("phila_storage");
  const provider = it?.creds.provider === "s3" ? "s3" : "supabase";
  const required = appOrigins();
  const { corsRuleFor } = await import("@/lib/storage/s3");
  const rule = corsRuleFor(required);
  if (provider !== "s3") return { ok: true, provider, required, allowed: required, satisfied: true, detail: "Supabase Storage allows browser uploads by default.", rule };
  const s3 = await resolveS3Creds({});
  if (!s3.s3_region || !s3.s3_bucket || !s3.s3_accessKeyId || !s3.s3_secretAccessKey) return { ok: false, provider, required, allowed: [], satisfied: false, detail: "Add the S3 details first.", rule };
  const { getBucketCors } = await import("@/lib/storage/s3");
  const state = await getBucketCors({ region: s3.s3_region, bucket: s3.s3_bucket, accessKeyId: s3.s3_accessKeyId, secretAccessKey: s3.s3_secretAccessKey, endpoint: s3.s3_endpoint || undefined });
  const satisfied = state.ok && required.every((o) => state.allowedOrigins.includes(o) || state.allowedOrigins.includes("*"));
  return { ok: state.ok, provider, required, allowed: state.allowedOrigins, satisfied, detail: state.detail, rule };
}

export async function applyStorageCors(): Promise<{ ok: true; origins: string[] } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const s3 = await resolveS3Creds({});
  if (!s3.s3_region || !s3.s3_bucket || !s3.s3_accessKeyId || !s3.s3_secretAccessKey) return { ok: false, error: "Add the S3 details first." };
  const origins = appOrigins();
  const { putBucketCors } = await import("@/lib/storage/s3");
  const res = await putBucketCors({ region: s3.s3_region, bucket: s3.s3_bucket, accessKeyId: s3.s3_accessKeyId, secretAccessKey: s3.s3_secretAccessKey, endpoint: s3.s3_endpoint || undefined }, origins);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:phila_storage", reason: res.ok ? "s3_cors_applied" : "s3_cors_refused" });
  if (!res.ok) return { ok: false, error: res.detail ?? "S3 refused." };
  return { ok: true, origins };
}

/* ── Batch 4m - web push (Phila's own VAPID keys) ─────────────────────────── */

const pushInput = z.object({ subject: z.string().max(200), enabled: z.boolean(), regenerate: z.boolean().default(false) });

/** Save / switch web push. Keys are generated here once (regenerate = every browser must re-subscribe). */
export async function saveWebPushConfig(raw: z.infer<typeof pushInput>): Promise<{ ok: true; publicKey: string } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = pushInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const d = parsed.data;
  const subject = d.subject.trim();
  if (subject && !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\/\S+)$/.test(subject)) return { ok: false, error: "Contact must be mailto:you@domain or an https:// URL." };
  const existing = (await getPlatformIntegration("web_push"))?.creds ?? {};
  let publicKey = existing.publicKey ?? "";
  let privateKey = existing.privateKey ?? "";
  if (!publicKey || !privateKey || d.regenerate) {
    const { generateVapidKeys } = await import("@/lib/push");
    ({ publicKey, privateKey } = generateVapidKeys());
  }
  await savePlatformIntegration("web_push", { publicKey, privateKey, subject: subject || "mailto:hello@philasa.com" }, d.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:web_push", reason: d.regenerate ? "web_push_keys_regenerated" : d.enabled ? "web_push_on" : "web_push_saved" });
  return { ok: true, publicKey };
}
