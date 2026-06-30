"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveMessagingSettings, saveWhatsappConnection, saveTemplate, resetTemplate } from "@/db/queries/messaging";

const time = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal(""));

const settingsInput = z.object({
  whatsappEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  emailReplyTo: z.string().email("Enter a valid reply-to email.").or(z.literal("")),
  emailFromName: z.string().max(80),
  quietStart: time,
  quietEnd: time,
});

export async function saveNotificationSettings(
  raw: z.infer<typeof settingsInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = settingsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the settings." };
  const d = parsed.data;
  await saveMessagingSettings(membership.orgId, {
    whatsappEnabled: d.whatsappEnabled, smsEnabled: d.smsEnabled, emailEnabled: d.emailEnabled,
    emailReplyTo: d.emailReplyTo || null, emailFromName: d.emailFromName || null,
    quietStart: d.quietStart || null, quietEnd: d.quietEnd || null,
  });
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/messaging`, reason: "update_notification_settings" });
  return { ok: true };
}

const whatsappInput = z.object({
  phoneNumberId: z.string().trim().min(3, "Enter your Phone Number ID."),
  wabaId: z.string().trim().max(64).default(""),
  accessToken: z.string().trim().default(""),
  appSecret: z.string().trim().default(""),
  verifyToken: z.string().trim().min(4, "Set a verify token (any secret string)."),
});

export async function saveWhatsapp(
  raw: z.input<typeof whatsappInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = whatsappInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the WhatsApp details." };
  await saveWhatsappConnection(membership.orgId, parsed.data);
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/whatsapp`, reason: "connect_whatsapp" });
  return { ok: true };
}

const templateInput = z.object({
  channel: z.enum(["whatsapp", "sms", "email"]),
  key: z.enum(["booked", "rescheduled", "cancelled", "reminder", "no_show", "document_shared", "client_uploaded_document"]),
  body: z.string().trim().min(1, "Message can't be empty.").max(2000),
  whatsappTemplateName: z.string().trim().max(120).default(""),
});

export async function saveMessageTemplate(
  raw: z.input<typeof templateInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = templateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the template." };
  const d = parsed.data;
  await saveTemplate(membership.orgId, d.channel, d.key, d.body, d.whatsappTemplateName || null);
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/template:${d.channel}.${d.key}`, reason: "edit_template" });
  return { ok: true };
}

const resetInput = z.object({ channel: z.enum(["whatsapp", "sms", "email"]), key: z.enum(["booked", "rescheduled", "cancelled", "reminder", "no_show", "document_shared", "client_uploaded_document"]) });

export async function resetMessageTemplate(
  raw: z.infer<typeof resetInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  const parsed = resetInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await resetTemplate(membership.orgId, parsed.data.channel, parsed.data.key);
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/template:${parsed.data.channel}.${parsed.data.key}`, reason: "reset_template" });
  return { ok: true };
}

/** "Help me set up WhatsApp"  logs a setup-assist request for the platform team. */
export async function requestWhatsappSetup(): Promise<{ ok: true }> {
  const { membership } = await requireHub();
  await logAccess({ action: "admin.action", actor: { userId: "hub", platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/whatsapp`, reason: "request_setup_help" });
  return { ok: true };
}
