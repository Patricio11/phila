"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveBusinessHours as persistBusinessHours, saveClientPortal as persistClientPortal, setOrgFeature as persistOrgFeature, saveSchedulingDefaults as persistSchedulingDefaults, saveOrgProfileDb, saveOrgBrandingDb, saveOrgLogoDb, getOrgLogoDb, saveInvoiceSettingsDb as persistInvoiceSettings } from "@/db/queries/settings";
import { saveVideoSettings } from "@/db/queries/video";
import { saveAiSettings } from "@/db/queries/ai";
import { ORG_FEATURES } from "@/lib/domain/enums";
import { getStorageProvider } from "@/lib/storage";
import { scanObject } from "@/lib/documents/scan";
import { currentStorageBytes, addStorageUsage } from "@/db/queries/documents";
import { orgStorageLimitBytes } from "@/db/queries/resources";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

/**
 * AI scribe consent + budget (Phase 14). The `aiEnabled` toggle IS the POPIA
 * cross-border consent gate  the scribe stays off for this org until it's on.
 */
const aiInput = z.object({
  aiEnabled: z.boolean(),
  monthlyCapRands: z.number().int().min(0).max(1000000),
});

export async function saveOrgAiSettings(
  raw: z.infer<typeof aiInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the AI settings." };
  await saveAiSettings(membership.orgId, { aiEnabled: parsed.data.aiEnabled, monthlyCapCents: parsed.data.monthlyCapRands * 100 });
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/ai`, reason: parsed.data.aiEnabled ? "ai_consent_on" : "ai_consent_off" });
  return { ok: true };
}

/**
 * Video mode (Phase 13): in-app LiveKit room, or the org's own pasted meeting
 * link (paste-link fallback). Validated + audited.
 */
const videoInput = z.object({
  mode: z.enum(["livekit", "external"]),
  externalUrl: z.string().trim().url("Enter a valid meeting link (https://…).").or(z.literal("")),
});

export async function saveVideoMode(
  raw: z.infer<typeof videoInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = videoInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the video settings." };
  if (parsed.data.mode === "external" && !parsed.data.externalUrl) return { ok: false, error: "Paste your meeting link to use your own video." };
  await saveVideoSettings(membership.orgId, { mode: parsed.data.mode, externalUrl: parsed.data.externalUrl || null });
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/video`, reason: `video_${parsed.data.mode}` });
  return { ok: true };
}

/**
 * Working hours (mock). Validated + audited; Phase 11 persists them and the
 * scheduling engine enforces them server-side. Setting a day closed blocks
 * booking on that day across the calendar.
 */
const time = z.string().regex(/^\d{2}:\d{2}$/);
const day = z.object({ start: time, end: time }).nullable();
const input = z.object({
  hours: z.object({
    1: day, 2: day, 3: day, 4: day, 5: day, 6: day, 7: day,
  }),
});

/**
 * Scheduling defaults: the default session length and the inter-session interval
 * (buffer) that keeps bookings from being back-to-back. The slot engine pads every
 * booked window by the interval on each side, so the next start is only offered
 * once the interval has passed. Validated + audited; persisted to scheduling JSONB.
 */
const defaultsInput = z.object({
  defaultDurationMin: z.number().int().min(10, "A session is at least 10 minutes.").max(480, "Keep a session under 8 hours."),
  bufferMin: z.number().int().min(0, "The interval can't be negative.").max(120, "Keep the interval under 2 hours."),
  changeNoticeHours: z.number().int().min(0, "Notice can't be negative.").max(168, "Keep the notice under a week."),
});

export async function saveSchedulingDefaults(
  raw: z.infer<typeof defaultsInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = defaultsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values." };
  if (process.env.DATA_PROVIDER === "db") await persistSchedulingDefaults(membership.orgId, parsed.data);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/scheduling_defaults`,
    reason: `interval_${parsed.data.bufferMin}_duration_${parsed.data.defaultDurationMin}`,
  });
  revalidatePath("/hub/settings");
  return { ok: true };
}

export async function saveBusinessHours(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the times you entered." };
  for (const d of Object.values(parsed.data.hours)) {
    if (d && d.end <= d.start) return { ok: false, error: "Each day's end time must be after its start." };
  }

  if (process.env.DATA_PROVIDER === "db") await persistBusinessHours(membership.orgId, parsed.data.hours);

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/business_hours`,
    reason: "update_business_hours",
  });
  return { ok: true };
}

/**
 * Client-portal onboarding policy. Both default OFF  many orgs serve clients who
 * won't use a portal, so nobody gets a set-password link unless the org opts in
 * (or clicks "Invite to portal" on the client). Validated + audited; persisted to
 * the org's client_portal JSONB.
 */
const portalInput = z.object({ inviteOnBooking: z.boolean(), inviteOnCreate: z.boolean() });

export async function saveClientPortalSettings(
  raw: z.infer<typeof portalInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = portalInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the portal settings." };
  if (process.env.DATA_PROVIDER === "db") await persistClientPortal(membership.orgId, parsed.data);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/client_portal`,
    reason: `portal_booking_${parsed.data.inviteOnBooking ? "on" : "off"}_create_${parsed.data.inviteOnCreate ? "on" : "off"}`,
  });
  revalidatePath("/hub/settings");
  revalidatePath("/hub/clients");
  return { ok: true };
}

/**
 * Toggle an org feature flag (Dormant-by-Default). Currently the org-facing switch
 * for the Funders & grants (M&E) module  off by default, so the whole area (nav +
 * pages) only appears once an org opts in. Validated + audited; persisted to the
 * org's features JSONB.
 */
const featureInput = z.object({ feature: z.enum(ORG_FEATURES), enabled: z.boolean() });

export async function saveOrgFeature(
  raw: z.infer<typeof featureInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = featureInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Unknown feature." };
  if (process.env.DATA_PROVIDER === "db") await persistOrgFeature(membership.orgId, parsed.data.feature, parsed.data.enabled);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/feature/${parsed.data.feature}`,
    reason: parsed.data.enabled ? "feature_on" : "feature_off",
  });
  revalidatePath("/hub", "layout");
  return { ok: true };
}

const profileInput = z.object({
  name: z.string().min(2, "Enter your organisation name."),
  tradingName: z.string().optional().or(z.literal("")),
  registrationNo: z.string().optional().or(z.literal("")),
  practiceNo: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().regex(/^(\+27|0)\d{9}$/, "Use a SA number, e.g. 011 234 5678.").optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
});

/** Organisation profile (mock). Validated + audited; Phase 10 persists to the org row. */
export async function saveOrgProfile(
  raw: z.infer<typeof profileInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  if (process.env.DATA_PROVIDER === "db") {
    const { name, ...profile } = parsed.data;
    // Drop empty strings so the stored profile stays tidy.
    const clean = Object.fromEntries(Object.entries(profile).filter(([, v]) => (v ?? "").trim() !== "")) as Record<string, string>;
    await saveOrgProfileDb(membership.orgId, name.trim(), clean);
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/profile`,
    reason: "update_org_profile",
  });
  revalidatePath("/hub/settings");
  return { ok: true };
}

const brandingInput = z.object({
  brandAccent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #1C7D58."),
});

/** Set the org's brand accent  the colour used across the hub, the client portal, and the public page. */
export async function saveOrgBranding(
  raw: z.infer<typeof brandingInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = brandingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the colour." };
  if (process.env.DATA_PROVIDER === "db") await saveOrgBrandingDb(membership.orgId, parsed.data.brandAccent.toUpperCase());
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/branding`,
    reason: "update_org_branding",
  });
  revalidatePath("/hub/settings");
  revalidatePath("/", "layout"); // the accent shows app-wide + on the public page
  return { ok: true };
}

/* ── Org logo (W6.1): image upload via storage; shown on the public page + booking ── */

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const logoInput = z.object({ name: z.string().trim().min(1).max(160), contentType: z.string().trim().min(1), bytes: z.number().int().positive() });

/** Presign a logo upload (image ≤ 2 MB). The browser PUTs the bytes, then confirms. Quota-checked. */
export async function requestLogoUpload(
  raw: z.infer<typeof logoInput>,
): Promise<{ ok: true; uploadUrl: string; key: string; bytes: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = logoInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the image." };
  if (!LOGO_TYPES.has(parsed.data.contentType)) return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  if (parsed.data.bytes > LOGO_MAX_BYTES) return { ok: false, error: "Keep the logo under 2 MB." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Phila Storage isn't switched on yet." };
  // The logo counts against org storage — net of the logo it replaces.
  const [used, current, limit] = await Promise.all([currentStorageBytes(membership.orgId), getOrgLogoDb(membership.orgId), orgStorageLimitBytes(membership.orgId)]);
  if (used - current.bytes + parsed.data.bytes > limit) return { ok: false, error: "You've reached your plan's storage. Remove files or upgrade for more." };

  const ext = parsed.data.contentType === "image/png" ? "png" : parsed.data.contentType === "image/webp" ? "webp" : "jpg";
  const key = `${membership.orgId}/branding/logo-${randomUUID()}.${ext}`;
  let uploadUrl: string;
  try {
    ({ uploadUrl } = await storage.signedUploadUrl({ key, contentType: parsed.data.contentType }));
  } catch {
    return { ok: false, error: "Storage rejected the upload  check the Phila Storage configuration." };
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/logo`, reason: "request_logo_upload" });
  return { ok: true, uploadUrl, key, bytes: parsed.data.bytes };
}

/** Finalise the logo after the PUT: scan, point the org at the new key, and reconcile storage. */
export async function confirmLogoUpload(
  raw: { key: string; bytes: number },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const key = String(raw?.key ?? "");
  const bytes = Number(raw?.bytes ?? 0);
  if (!key.startsWith(`${membership.orgId}/branding/`) || bytes <= 0) return { ok: false, error: "Invalid upload." };
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Files aren't available right now." };
  const scan = await scanObject(key);
  if (scan !== "clean") { try { await storage.remove(key); } catch { /* best effort */ } return { ok: false, error: "That image didn't pass the security scan." }; }

  const prev = await getOrgLogoDb(membership.orgId);
  await saveOrgLogoDb(membership.orgId, key, bytes);
  await addStorageUsage(membership.orgId, bytes - prev.bytes); // net change vs the replaced logo
  if (prev.key && prev.key !== key) { try { await storage.remove(prev.key); } catch { /* best effort */ } }

  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/logo`, reason: "set_logo" });
  revalidatePath("/hub/settings");
  revalidatePath("/o", "layout"); // public page + booking
  const url = await storage.signedDownloadUrl(key, 3600);
  return { ok: true, url };
}

/** Remove the org's logo (clears the key, deletes the object, releases its storage). */
export async function removeOrgLogo(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const prev = await getOrgLogoDb(membership.orgId);
  await saveOrgLogoDb(membership.orgId, null, 0);
  if (prev.bytes > 0) await addStorageUsage(membership.orgId, -prev.bytes);
  if (prev.key) { try { (await getStorageProvider()).remove(prev.key); } catch { /* best effort */ } }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/logo`, reason: "remove_logo" });
  revalidatePath("/hub/settings");
  revalidatePath("/o", "layout");
  return { ok: true };
}

/** A short-TTL URL for the org's current logo, for the settings preview. */
export async function getOrgLogoUrl(): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const { key } = await getOrgLogoDb(membership.orgId);
  if (!key) return { ok: true, url: null };
  try {
    const storage = await getStorageProvider();
    if (storage.status !== "live") return { ok: true, url: null };
    return { ok: true, url: await storage.signedDownloadUrl(key, 3600) };
  } catch {
    return { ok: true, url: null };
  }
}

const invoiceInput = z.object({
  vatRegistered: z.boolean(),
  vatNumber: z.string().trim().max(20).optional().or(z.literal("")),
  pricesIncludeVat: z.boolean(),
  invoicePrefix: z.string().trim().min(1, "Add an invoice prefix.").max(8, "Keep the prefix short.").regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and hyphens only."),
  paymentTermsDays: z.number().int().min(0).max(180),
  bankName: z.string().trim().max(60).optional().or(z.literal("")),
  accountName: z.string().trim().max(80).optional().or(z.literal("")),
  accountNumber: z.string().trim().max(20).regex(/^\d*$/, "Account number is digits only.").optional().or(z.literal("")),
  branchCode: z.string().trim().max(10).regex(/^\d*$/, "Branch code is digits only.").optional().or(z.literal("")),
  showPayButton: z.boolean(),
  autoInvoiceOnBooking: z.boolean(),
});

/**
 * Org invoicing/VAT setup (mock). The VAT *rate* is platform-wide (super admin);
 * here the org sets whether it's registered, its VAT number, and inclusive vs
 * exclusive pricing. Validated + audited; Phase 10 persists to the org row.
 */
export async function saveInvoiceSettings(
  raw: z.infer<typeof invoiceInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = invoiceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the VAT details." };
  if (parsed.data.vatRegistered && !parsed.data.vatNumber?.trim()) {
    return { ok: false, error: "Add your VAT number, or switch VAT registration off." };
  }
  if (process.env.DATA_PROVIDER === "db") {
    const d = parsed.data;
    await persistInvoiceSettings(membership.orgId, {
      vatRegistered: d.vatRegistered, vatNumber: d.vatNumber ?? "", pricesIncludeVat: d.pricesIncludeVat,
      invoicePrefix: d.invoicePrefix, paymentTermsDays: d.paymentTermsDays, bankName: d.bankName ?? "",
      accountName: d.accountName ?? "", accountNumber: d.accountNumber ?? "", branchCode: d.branchCode ?? "",
      showPayButton: d.showPayButton, autoInvoiceOnBooking: d.autoInvoiceOnBooking,
    });
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/invoice_settings`,
    reason: "update_invoice_settings",
  });
  revalidatePath("/hub/settings");
  revalidatePath("/hub/invoicing");
  return { ok: true };
}

const channelInput = z.object({
  channel: z.enum(["whatsapp", "sms", "email"]),
  provider: z.string().min(1, "Pick a provider."),
  fields: z.record(z.string(), z.string()),
});

/**
 * Connect a messaging channel with the org's **own** provider credentials (BYO).
 * Mock: validated + audited; nothing sends. Phase 12 wires the channel rail and
 * stores credentials encrypted. Each channel is dormant until connected.
 */
export async function connectChannel(
  raw: z.infer<typeof channelInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = channelInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the connection details." };
  const required = Object.values(parsed.data.fields).filter((v) => v.trim().length > 0);
  if (required.length === 0) return { ok: false, error: "Enter your provider credentials." };
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/channel:${parsed.data.channel}`,
    reason: `connect_${parsed.data.channel}`,
  });
  return { ok: true };
}
