import "server-only";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgMessagingSettings, whatsappConnections, whatsappWindows, creditBalances, creditLedger, messageTemplates, messageLog, messageOptOuts } from "@/db/schema";
import { encryptField, decryptField } from "@/lib/crypto";
import { CHANNELS, TRIGGERS, DEFAULT_TEMPLATES, type Channel, type MessageTrigger } from "@/lib/messaging/templates";
import { windowKey } from "@/lib/messaging/whatsapp-window";

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
  verifiedAt: string | null;
}

/** Never returns the decrypted token  only whether one is stored. */
export async function getWhatsappConnection(orgId: string): Promise<WhatsappConnectionView> {
  const [row] = await getDb().select().from(whatsappConnections).where(eq(whatsappConnections.orgId, orgId)).limit(1);
  if (!row) return { status: "off", phoneNumberId: null, wabaId: null, hasToken: false, verifyToken: null, verifiedAt: null };
  return { status: row.status as WhatsappConnectionView["status"], phoneNumberId: row.phoneNumberId, wabaId: row.wabaId, hasToken: Boolean(row.accessTokenEnc), verifyToken: row.verifyToken, verifiedAt: row.verifiedAt?.toISOString() ?? null };
}

/** Promote a connection to "live" after a successful Graph API ping (records the moment). */
export async function markWhatsappVerified(orgId: string, ok: boolean): Promise<void> {
  await getDb().update(whatsappConnections)
    .set(ok ? { status: "live", verifiedAt: new Date(), updatedAt: new Date() } : { updatedAt: new Date() })
    .where(eq(whatsappConnections.orgId, orgId));
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
  if (seen) return seen.balanceAfter; // already applied  no double-count
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

/* ---- Pipeline primitives (Phase 12.3) -------------------------------- */

/** Raw WhatsApp creds for the transport (includes the ENCRYPTED token). Server-only. */
export async function getWhatsappCreds(orgId: string): Promise<{ phoneNumberId: string | null; accessTokenEnc: string | null; live: boolean }> {
  const [row] = await getDb().select().from(whatsappConnections).where(eq(whatsappConnections.orgId, orgId)).limit(1);
  return { phoneNumberId: row?.phoneNumberId ?? null, accessTokenEnc: row?.accessTokenEnc ?? null, live: Boolean(row && row.status !== "off") };
}

export async function isOptedOut(orgId: string, channel: Channel, target: string): Promise<boolean> {
  const [row] = await getDb().select().from(messageOptOuts).where(and(eq(messageOptOuts.orgId, orgId), eq(messageOptOuts.channel, channel), eq(messageOptOuts.target, target))).limit(1);
  return Boolean(row);
}

/** Resolved template body for a channel × trigger (org override wins over the system default). */
export async function getTemplateBody(orgId: string, channel: Channel, key: MessageTrigger): Promise<string> {
  const rows = await getDb().select().from(messageTemplates).where(and(or(isNull(messageTemplates.orgId), eq(messageTemplates.orgId, orgId)), eq(messageTemplates.channel, channel), eq(messageTemplates.key, key)));
  const override = rows.find((r) => r.orgId === orgId);
  const sys = rows.find((r) => r.orgId === null);
  return override?.body ?? sys?.body ?? DEFAULT_TEMPLATES[channel][key];
}

/**
 * The org's Meta-approved WhatsApp template NAME for a trigger, used to reach a client
 * OUTSIDE the 24h window (Meta rejects free-form there). null = none configured, so an
 * out-of-window WhatsApp send is honestly skipped rather than bounced.
 */
export async function getWhatsappTemplateName(orgId: string, key: MessageTrigger): Promise<string | null> {
  const rows = await getDb().select({ orgId: messageTemplates.orgId, name: messageTemplates.whatsappTemplateName })
    .from(messageTemplates)
    .where(and(or(isNull(messageTemplates.orgId), eq(messageTemplates.orgId, orgId)), eq(messageTemplates.channel, "whatsapp"), eq(messageTemplates.key, key)));
  const override = rows.find((r) => r.orgId === orgId);
  const sys = rows.find((r) => r.orgId === null);
  return (override?.name ?? sys?.name) || null;
}

/* ---- WhatsApp 24-hour service window (WhatsApp-first) ------------------- */

/** Record an inbound WhatsApp message — refreshes (or opens) the client's free window. */
export async function recordWhatsappInbound(orgId: string, phone: string, at: Date): Promise<void> {
  const key = windowKey(phone);
  if (!key) return;
  await getDb().insert(whatsappWindows).values({ orgId, phoneKey: key, lastInboundAt: at, updatedAt: at })
    .onConflictDoUpdate({ target: [whatsappWindows.orgId, whatsappWindows.phoneKey], set: { lastInboundAt: at, updatedAt: at } });
}

/** The client's last inbound WhatsApp time (null if they've never messaged the org). */
export async function getWhatsappLastInbound(orgId: string, phone: string | null | undefined): Promise<Date | null> {
  const key = windowKey(phone);
  if (!key) return null;
  const [row] = await getDb().select({ at: whatsappWindows.lastInboundAt }).from(whatsappWindows)
    .where(and(eq(whatsappWindows.orgId, orgId), eq(whatsappWindows.phoneKey, key))).limit(1);
  return row?.at ?? null;
}

/** Idempotent 1-credit debit. ok:false when the balance is exhausted (blocks the send). */
export async function consumeCredit(orgId: string, channel: "sms" | "email", idempotencyKey: string, ref: string): Promise<{ ok: boolean; balanceAfter: number }> {
  const db = getDb();
  const [seen] = await db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
  if (seen) return { ok: true, balanceAfter: seen.balanceAfter }; // already charged  no double-count
  const [bal] = await db.select().from(creditBalances).where(and(eq(creditBalances.orgId, orgId), eq(creditBalances.channel, channel))).limit(1);
  const current = bal?.balance ?? 0;
  if (current <= 0) return { ok: false, balanceAfter: 0 };
  const after = current - 1;
  await db.update(creditBalances).set({ balance: after }).where(and(eq(creditBalances.orgId, orgId), eq(creditBalances.channel, channel)));
  await db.insert(creditLedger).values({ orgId, channel, delta: -1, reason: "send", ref, idempotencyKey, balanceAfter: after, createdAt: new Date() });
  return { ok: true, balanceAfter: after };
}

/** Record a send with an honest delivery state. `to` is masked before storage. */
export async function logMessage(input: { orgId: string; channel: Channel; to: string; templateKey: MessageTrigger; trigger: MessageTrigger; status: string; detail?: string; providerMessageId?: string; costCredits?: number }): Promise<void> {
  await getDb().insert(messageLog).values({
    orgId: input.orgId, channel: input.channel, toMasked: maskTarget(input.to), templateKey: input.templateKey,
    trigger: input.trigger, status: input.status, detail: input.detail ?? null, providerMessageId: input.providerMessageId ?? null,
    costCredits: input.costCredits ?? 0, createdAt: new Date(),
  });
}

/** Mask a phone/email for the message log (POPIA  no raw contact in logs). */
export function maskTarget(target: string): string {
  if (target.includes("@")) {
    const [u, d] = target.split("@");
    return `${(u ?? "").slice(0, 2)}***@${d ?? ""}`;
  }
  return target.length > 4 ? `${target.slice(0, 3)}***${target.slice(-2)}` : "***";
}

/* ---- Inbound / webhooks (Phase 12.6) --------------------------------- */

export async function addOptOut(orgId: string, channel: Channel, target: string, reason: string): Promise<void> {
  await getDb().insert(messageOptOuts).values({ orgId, channel, target, reason, createdAt: new Date() }).onConflictDoNothing();
}

/** Find the org that owns a WhatsApp phone-number-id (routes inbound webhooks). */
export async function getOrgByWhatsappPhone(phoneNumberId: string): Promise<string | null> {
  const [row] = await getDb().select({ orgId: whatsappConnections.orgId }).from(whatsappConnections).where(eq(whatsappConnections.phoneNumberId, phoneNumberId)).limit(1);
  return row?.orgId ?? null;
}

/** The org's Meta app secret (decrypted) for a phone number — to verify the webhook HMAC. */
export async function getWhatsappAppSecretByPhone(phoneNumberId: string): Promise<string | null> {
  const [row] = await getDb().select({ enc: whatsappConnections.appSecretEnc }).from(whatsappConnections).where(eq(whatsappConnections.phoneNumberId, phoneNumberId)).limit(1);
  if (!row?.enc) return null;
  try {
    return decryptField(row.enc);
  } catch {
    return null;
  }
}

/** Does any org use this WhatsApp verify token? (webhook GET verification). */
export async function whatsappVerifyTokenExists(token: string): Promise<boolean> {
  const [row] = await getDb().select({ orgId: whatsappConnections.orgId }).from(whatsappConnections).where(eq(whatsappConnections.verifyToken, token)).limit(1);
  return Boolean(row);
}

/** Update a sent message's delivery state from a provider status webhook. */
export async function updateMessageStatus(providerMessageId: string, status: string, detail?: string): Promise<void> {
  await getDb().update(messageLog).set({ status, detail: detail ?? null }).where(eq(messageLog.providerMessageId, providerMessageId));
}

/** Recent message activity for an org (the Notifications activity view). `to` already masked. */
export async function listRecentMessages(orgId: string, limit = 20): Promise<{ channel: string; toMasked: string; trigger: string; status: string; createdAt: string }[]> {
  const rows = await getDb().select().from(messageLog).where(eq(messageLog.orgId, orgId)).orderBy(desc(messageLog.createdAt)).limit(limit);
  return rows.map((r) => ({ channel: r.channel, toMasked: r.toMasked, trigger: r.trigger, status: r.status, createdAt: r.createdAt.toISOString() }));
}

/** Org that owns a sent message (for routing email bounce/complaint → opt-out). */
export async function getMessageOrg(providerMessageId: string): Promise<string | null> {
  const [row] = await getDb().select({ orgId: messageLog.orgId }).from(messageLog).where(eq(messageLog.providerMessageId, providerMessageId)).limit(1);
  return row?.orgId ?? null;
}
