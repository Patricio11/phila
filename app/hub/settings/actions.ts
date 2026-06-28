"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

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
