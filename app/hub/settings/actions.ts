"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveBusinessHours as persistBusinessHours } from "@/db/queries/settings";
import { saveVideoSettings } from "@/db/queries/video";
import { saveAiSettings } from "@/db/queries/ai";

/**
 * AI scribe consent + budget (Phase 14). The `aiEnabled` toggle IS the POPIA
 * cross-border consent gate — the scribe stays off for this org until it's on.
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
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/profile`,
    reason: "update_org_profile",
  });
  return { ok: true };
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
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/invoice_settings`,
    reason: "update_invoice_settings",
  });
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
