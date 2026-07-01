"use server";

import { z } from "zod";
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
const lkInput = z.object({
  mode: z.enum(["demo", "live"]),
  wsUrl: z.string().trim().max(200),
  apiKey: z.string().trim().max(200),
  apiSecret: z.string().trim().default(""),
  enabled: z.boolean(),
});

async function resolveLkSecret(provided: string): Promise<string> {
  if (provided) return provided;
  const existing = await getPlatformIntegration("livekit");
  return existing?.creds.apiSecret ?? "";
}

export async function saveLivekitConfig(raw: z.infer<typeof lkInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = lkInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const d = parsed.data;
  const apiSecret = await resolveLkSecret(d.apiSecret);
  if (d.enabled && (!d.wsUrl || !d.apiKey || !apiSecret)) return { ok: false, error: "Add the URL, key, and secret before switching it on." };

  await savePlatformIntegration("livekit", { mode: d.mode, wsUrl: d.wsUrl, apiKey: d.apiKey, apiSecret }, d.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:livekit", reason: d.enabled ? `enable_livekit_${d.mode}` : "save_livekit" });
  return { ok: true };
}

export async function testLivekitConnection(raw: { wsUrl: string; apiKey: string; apiSecret: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const apiSecret = await resolveLkSecret((raw.apiSecret ?? "").trim());
  return testLivekit((raw.wsUrl ?? "").trim(), (raw.apiKey ?? "").trim(), apiSecret);
}

/**
 * Phila Storage (Phase 18)  the platform file store. Super-admin enters the
 * Supabase project URL + service-role key + (private) bucket, tests, and switches
 * on. The key is encrypted at rest; a blank key field keeps the stored one. Until
 * switched on, document uploads stay honestly dormant (Dormant-by-Default).
 */
const storageInput = z.object({
  url: z.string().trim().max(200),
  serviceKey: z.string().trim().default(""),
  bucket: z.string().trim().max(100),
  /** Public anon key — used by the browser for Supabase Realtime (chat live + presence). */
  anonKey: z.string().trim().max(400).default(""),
  /** Supabase JWT secret — signs scoped realtime tokens for private channels (opt-in). */
  jwtSecret: z.string().trim().max(400).default(""),
  /** Enable RLS-authorized private realtime channels (requires the setup SQL). */
  realtimePrivate: z.boolean().default(false),
  enabled: z.boolean(),
});

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
  const existing = await getPlatformIntegration(STORAGE_KEY);
  const anonKey = d.anonKey.trim() || existing?.creds.anonKey || "";
  const jwtSecret = d.jwtSecret.trim() || existing?.creds.jwtSecret || "";
  if (d.enabled && (!creds.url || !creds.serviceKey || !creds.bucket))
    return { ok: false, error: "Add the project URL, service-role key, and bucket before switching it on." };
  if (d.realtimePrivate && !jwtSecret)
    return { ok: false, error: "Add the Supabase JWT secret before enabling private channels." };

  await savePlatformIntegration(STORAGE_KEY, { ...creds, anonKey, jwtSecret, realtimePrivate: d.realtimePrivate ? "true" : "false" }, d.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:phila_storage", reason: d.enabled ? "enable_storage" : "save_storage" });
  return { ok: true };
}

export async function testStorageConnectionAction(raw: { url: string; serviceKey: string; bucket: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const creds = await resolveStorageCreds(raw);
  const res = await testStorageConnection(creds);
  return { ok: res.ok, detail: res.detail ?? (res.ok ? "Bucket reachable." : "Could not connect.") };
}

/**
 * Phila SMS (BulkSMS) — the platform SMS sender orgs buy credits against. Token
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
    if (res.status === 401) return { ok: false, detail: "Token rejected — check the ID + secret." };
    return { ok: false, detail: `BulkSMS returned ${res.status}.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach BulkSMS." };
  }
}

/**
 * Phila email (Resend) — sends from Phila's verified domain with the practice as
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
