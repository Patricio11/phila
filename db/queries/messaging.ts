import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgMessagingSettings, whatsappConnections, creditBalances, creditLedger, messageTemplates } from "@/db/schema";
import { encryptField } from "@/lib/crypto";
import { CHANNELS, TRIGGERS, DEFAULT_TEMPLATES, type Channel, type MessageTrigger } from "@/lib/messaging/templates";

export interface MessagingSettings {
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  emailReplyTo: string | null;
  emailFromName: string | null;
  quietStart: string | null;
  quietEnd: string | null;
}

const DEFAULT_SETTINGS: MessagingSettings = {
  whatsappEnabled: false, smsEnabled: false, emailEnabled: false,
  emailReplyTo: null, emailFromName: null, quietStart: null, quietEnd: null,
};

export async function getMessagingSettings(orgId: string): Promise<MessagingSettings> {
  const [row] = await getDb().select().from(orgMessagingSettings).where(eq(orgMessagingSettings.orgId, orgId)).limit(1);
  if (!row) return DEFAULT_SETTINGS;
  return { whatsappEnabled: row.whatsappEnabled, smsEnabled: row.smsEnabled, emailEnabled: row.emailEnabled, emailReplyTo: row.emailReplyTo, emailFromName: row.emailFromName, quietStart: row.quietStart, quietEnd: row.quietEnd };
}

export async function saveMessagingSettings(orgId: string, s: MessagingSettings): Promise<void> {
  const values = { orgId, ...s, updatedAt: new Date() };
  await getDb().insert(orgMessagingSettings).values(values).onConflictDoUpdate({ target: orgMessagingSettings.orgId, set: { ...s, updatedAt: new Date() } });
}

export interface WhatsappConnectionView {
  status: "off" | "configured" | "live";
  phoneNumberId: string | null;
  wabaId: string | null;
  hasToken: boolean;
  verifyToken: string | null;
}

/** Never returns the decrypted token — only whether one is stored. */
export async function getWhatsappConnection(orgId: string): Promise<WhatsappConnectionView> {
  const [row] = await getDb().select().from(whatsappConnections).where(eq(whatsappConnections.orgId, orgId)).limit(1);
  if (!row) return { status: "off", phoneNumberId: null, wabaId: null, hasToken: false, verifyToken: null };
  return { status: row.status as WhatsappConnectionView["status"], phoneNumberId: row.phoneNumberId, wabaId: row.wabaId, hasToken: Boolean(row.accessTokenEnc), verifyToken: row.verifyToken };
}

export async function saveWhatsappConnection(orgId: string, input: { phoneNumberId: string; wabaId: string; accessToken?: string; appSecret?: string; verifyToken: string }): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(whatsappConnections).where(eq(whatsappConnections.orgId, orgId)).limit(1);
  // Blank token on edit = keep the stored one.
  const accessTokenEnc = input.accessToken ? encryptField(input.accessToken) : existing?.accessTokenEnc ?? null;
  const appSecretEnc = input.appSecret ? encryptField(input.appSecret) : existing?.appSecretEnc ?? null;
  const configured = Boolean(input.phoneNumberId && accessTokenEnc);
  const values = {
    orgId, phoneNumberId: input.phoneNumberId, wabaId: input.wabaId, accessTokenEnc, appSecretEnc,
    verifyToken: input.verifyToken, status: configured ? "configured" : "off", updatedAt: new Date(),
  };
  await db.insert(whatsappConnections).values(values).onConflictDoUpdate({ target: whatsappConnections.orgId, set: { phoneNumberId: values.phoneNumberId, wabaId: values.wabaId, accessTokenEnc, appSecretEnc, verifyToken: values.verifyToken, status: values.status, updatedAt: values.updatedAt } });
}

export async function getCreditBalances(orgId: string): Promise<{ sms: number; email: number }> {
  const rows = await getDb().select().from(creditBalances).where(eq(creditBalances.orgId, orgId));
  const by = (c: string) => rows.find((r) => r.channel === c)?.balance ?? 0;
  return { sms: by("sms"), email: by("email") };
}

/** Idempotent credit movement (+grant/purchase, −send). Returns the new balance. */
export async function applyCredit(orgId: string, channel: "sms" | "email", delta: number, reason: string, ref: string, idempotencyKey: string): Promise<number> {
  const db = getDb();
  const [seen] = await db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
  if (seen) return seen.balanceAfter; // already applied — no double-count
  const [bal] = await db.select().from(creditBalances).where(and(eq(creditBalances.orgId, orgId), eq(creditBalances.channel, channel))).limit(1);
  const after = Math.max(0, (bal?.balance ?? 0) + delta);
  await db.insert(creditBalances).values({ orgId, channel, balance: after }).onConflictDoUpdate({ target: [creditBalances.orgId, creditBalances.channel], set: { balance: after } });
  await db.insert(creditLedger).values({ orgId, channel, delta, reason, ref, idempotencyKey, balanceAfter: after, createdAt: new Date() });
  return after;
}

export interface TemplateView {
  channel: Channel;
  key: MessageTrigger;
  body: string;
  whatsappTemplateName: string | null;
  isOverride: boolean; // true = org has customised it
}

/** Resolved templates: an org override wins over the system default for each channel × trigger. */
export async function getTemplates(orgId: string): Promise<TemplateView[]> {
  const rows = await getDb().select().from(messageTemplates).where(or(isNull(messageTemplates.orgId), eq(messageTemplates.orgId, orgId)));
  const out: TemplateView[] = [];
  for (const channel of CHANNELS) {
    for (const key of TRIGGERS) {
      const override = rows.find((r) => r.orgId === orgId && r.channel === channel && r.key === key);
      const sys = rows.find((r) => r.orgId === null && r.channel === channel && r.key === key);
      out.push({
        channel, key,
        body: override?.body ?? sys?.body ?? DEFAULT_TEMPLATES[channel][key],
        whatsappTemplateName: override?.whatsappTemplateName ?? sys?.whatsappTemplateName ?? null,
        isOverride: Boolean(override),
      });
    }
  }
  return out;
}

export async function saveTemplate(orgId: string, channel: Channel, key: MessageTrigger, body: string, whatsappTemplateName: string | null): Promise<void> {
  const id = `tpl_${orgId}_${channel}_${key}`;
  const values = { id, orgId, channel, key, body, whatsappTemplateName, updatedAt: new Date() };
  await getDb().insert(messageTemplates).values(values).onConflictDoUpdate({ target: messageTemplates.id, set: { body, whatsappTemplateName, updatedAt: new Date() } });
}

/** Drop the org override so the Phila system default applies again. */
export async function resetTemplate(orgId: string, channel: Channel, key: MessageTrigger): Promise<void> {
  await getDb().delete(messageTemplates).where(and(eq(messageTemplates.orgId, orgId), eq(messageTemplates.channel, channel), eq(messageTemplates.key, key)));
}
