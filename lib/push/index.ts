import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { getPlatformIntegration } from "@/db/queries/platform-integrations";

/**
 * Batch 4m - web push (the fourth lane beside WhatsApp / SMS / email). Phila's
 * own VAPID keys live on the `web_push` platform integration (generated once in
 * Admin → Integrations → Web push; private key encrypted at rest). Dormant until
 * switched on. A push NEVER carries a message body - same rule as every nudge -
 * and uses a replacing `tag` per conversation so a phone never stacks ten
 * "new message" cards. Endpoints that answer 404/410 are pruned on the spot.
 */

export interface PushConfig { publicKey: string; privateKey: string; subject: string }

export async function getPushConfig(): Promise<PushConfig | null> {
  const it = await getPlatformIntegration("web_push");
  if (!it?.enabled || !it.creds.publicKey || !it.creds.privateKey) return null;
  return { publicKey: it.creds.publicKey, privateKey: it.creds.privateKey, subject: it.creds.subject || "mailto:hello@philasa.com" };
}

/** Public half only - what the browser needs to subscribe. Null = push is off. */
export async function getPushPublicKey(): Promise<string | null> {
  return (await getPushConfig())?.publicKey ?? null;
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

export interface PushMessage { title: string; body: string; url: string; tag: string }

/**
 * Push `msg` to every browser a set of users subscribed. Returns the user ids
 * that were reached (at least one subscription accepted the push) - the nudge
 * rail treats "reached by push" like "online" and skips the external lane.
 */
export async function pushToUsers(userIds: string[], msg: PushMessage, cfg?: PushConfig | null): Promise<{ reached: Set<string>; sent: number; pruned: number }> {
  const reached = new Set<string>();
  if (!userIds.length) return { reached, sent: 0, pruned: 0 };
  const config = cfg === undefined ? await getPushConfig() : cfg;
  if (!config) return { reached, sent: 0, pruned: 0 };
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  if (!subs.length) return { reached, sent: 0, pruned: 0 };
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag });
  let sent = 0, pruned = 0;
  const dead: string[] = [];
  const ok: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60, urgency: "high" });
      sent += 1; reached.add(s.userId); ok.push(s.id);
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) dead.push(s.id);
    }
  }));
  if (ok.length) await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(inArray(pushSubscriptions.id, ok));
  if (dead.length) { await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead)); pruned = dead.length; }
  return { reached, sent, pruned };
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null): Promise<void> {
  const db = getDb();
  const id = `push_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await db.insert(pushSubscriptions).values({ id, userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent, createdAt: new Date() })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent } });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function countSubscriptions(userId: string): Promise<number> {
  const rows = await getDb().select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}
