import "server-only";
import { and, eq, gte, sql, count } from "drizzle-orm";
import { getDb } from "@/db/client";
import { whatsappNumberHealth, whatsappConnections, processedEvents, deadLetters, messageLog, orgs } from "@/db/schema";
import { HEALTHY, mergeHealth, sendsPaused, statusGuidance, type NumberHealth } from "@/lib/messaging/whatsapp-health";
import { maskTarget } from "@/lib/messaging/retry";

/** Phase 34.3 - the org's number health (a healthy default when Meta has never told us anything). */
export async function readNumberHealth(orgId: string): Promise<NumberHealth> {
  const [row] = await getDb().select().from(whatsappNumberHealth).where(eq(whatsappNumberHealth.orgId, orgId)).limit(1);
  if (!row) return HEALTHY;
  return {
    quality: row.quality as NumberHealth["quality"],
    status: row.status as NumberHealth["status"],
    dailyLimit: row.dailyLimit,
    tierLabel: row.tierLabel,
    displayPhone: row.displayPhone,
    flaggedAt: row.flaggedAt ? row.flaggedAt.toISOString() : null,
    lastEventAt: row.lastEventAt ? row.lastEventAt.toISOString() : null,
  };
}

/**
 * Apply a Meta event (or the Test-connection ping). On a STATUS change the
 * org's admins are told (bell + audit) so a flagged number never goes unnoticed.
 */
export async function upsertNumberHealth(orgId: string, patch: Partial<NumberHealth>, source: "meta" | "verify"): Promise<{ before: NumberHealth; after: NumberHealth; changed: boolean }> {
  const db = getDb();
  const before = await readNumberHealth(orgId);
  const now = new Date();
  const after = mergeHealth(before, patch, now);
  await db.insert(whatsappNumberHealth).values({
    orgId, quality: after.quality, status: after.status, dailyLimit: after.dailyLimit, tierLabel: after.tierLabel, displayPhone: after.displayPhone,
    flaggedAt: after.flaggedAt ? new Date(after.flaggedAt) : null, lastEventAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: whatsappNumberHealth.orgId,
    set: { quality: after.quality, status: after.status, dailyLimit: after.dailyLimit, tierLabel: after.tierLabel, displayPhone: after.displayPhone, flaggedAt: after.flaggedAt ? new Date(after.flaggedAt) : null, lastEventAt: now, updatedAt: now },
  });
  const changed = before.status !== after.status || before.quality !== after.quality;
  if (changed && source === "meta") {
    const { logAccess } = await import("@/lib/audit");
    const { notifyOrgAdmins } = await import("@/db/queries/notifications");
    await logAccess({ action: "admin.action", actor: { userId: "system:meta", platformRole: null, teamRole: null }, orgId, target: `whatsapp:${orgId}`, reason: `number_health_${after.status}_${after.quality}` });
    const guidance = statusGuidance(after);
    if (guidance) {
      await notifyOrgAdmins(orgId, {
        kind: sendsPaused(after.status) ? "whatsapp_paused" : "whatsapp_health",
        title: sendsPaused(after.status) ? "WhatsApp sends paused - Meta restricted your number" : `WhatsApp number health: ${after.status === "flagged" ? "flagged" : `quality ${after.quality}`}`,
        body: guidance,
        href: "/hub/settings/notifications",
      });
    } else if (before.status !== "connected" || before.quality === "red") {
      await notifyOrgAdmins(orgId, { kind: "whatsapp_health", title: "WhatsApp number recovered", body: "Meta reports your number is healthy again. Sends are back to full speed.", href: "/hub/settings/notifications" });
    }
  }
  return { before, after, changed };
}

/** Meta's health events carry the human number, not the id - route by it. */
export async function findOrgByDisplayPhone(displayPhone: string): Promise<string | null> {
  const digits = displayPhone.replace(/\D/g, "");
  if (!digits) return null;
  const rows = await getDb().select({ orgId: whatsappConnections.orgId, dp: whatsappConnections.displayPhone }).from(whatsappConnections);
  const hit = rows.find((r) => (r.dp ?? "").replace(/\D/g, "") === digits);
  return hit?.orgId ?? null;
}

/** Store what Meta told us on Test connection (display phone + verified name). */
export async function recordWhatsappIdentity(orgId: string, displayPhone: string | null, verifiedName: string | null): Promise<void> {
  await getDb().update(whatsappConnections).set({ displayPhone, verifiedName, updatedAt: new Date() }).where(eq(whatsappConnections.orgId, orgId));
}

/**
 * Webhook idempotency: claim an event id atomically. True = first time (act);
 * false = seen before (skip). Fails OPEN on a DB error - a duplicate is cheaper
 * than a lost event.
 */
export async function claimEvent(provider: string, eventId: string): Promise<boolean> {
  try {
    const rows = await getDb().insert(processedEvents).values({ id: `${provider}:${eventId}`, provider }).onConflictDoNothing().returning({ id: processedEvents.id });
    return rows.length > 0;
  } catch {
    return true;
  }
}

/** A send that failed after transient retries - one row per idempotency key, recipient masked. */
export async function recordDeadLetter(orgId: string, channel: string, target: string, reason: string, attempts: number, key: string): Promise<void> {
  try {
    const now = new Date();
    await getDb().insert(deadLetters).values({ id: `dl_${key}`, orgId, channel, target: maskTarget(target), reason: reason.slice(0, 280), attempts, at: now })
      .onConflictDoUpdate({ target: deadLetters.id, set: { reason: reason.slice(0, 280), attempts, at: now } });
  } catch { /* never let ops bookkeeping break a send */ }
}

/** How many WhatsApp messages this org actually SENT in a window (the throttle's meter). */
export async function whatsappSentSince(orgId: string, since: Date): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(messageLog)
    .where(and(eq(messageLog.orgId, orgId), eq(messageLog.channel, "whatsapp"), gte(messageLog.createdAt, since), sql`${messageLog.status} in ('sent','delivered','read')`));
  return Number(row?.n ?? 0);
}

/** Recent dead letters for an org (Billing's honest "failed after retries" list). */
export async function listDeadLetters(orgId: string, limit = 10): Promise<{ channel: string; target: string; reason: string; attempts: number; at: string }[]> {
  const rows = await getDb().select().from(deadLetters).where(eq(deadLetters.orgId, orgId)).orderBy(sql`${deadLetters.at} desc`).limit(limit);
  return rows.map((r) => ({ channel: r.channel, target: r.target, reason: r.reason, attempts: r.attempts, at: r.at.toISOString() }));
}

/**
 * Phase 34.5 - super-admin: every org's WhatsApp number at a glance (status,
 * display phone, health, last Meta event). Cross-org on purpose - owner
 * connection, super-admin only.
 */
export async function listOrgWhatsappNumbers(): Promise<{ orgId: string; orgName: string; status: string; displayPhone: string | null; verifiedName: string | null; verifiedAt: string | null; health: NumberHealth | null }[]> {
  const db = getDb();
  const rows = await db.select({
    orgId: whatsappConnections.orgId, orgName: orgs.name, status: whatsappConnections.status, displayPhone: whatsappConnections.displayPhone,
    verifiedName: whatsappConnections.verifiedName, verifiedAt: whatsappConnections.verifiedAt,
    hq: whatsappNumberHealth.quality, hs: whatsappNumberHealth.status, hd: whatsappNumberHealth.dailyLimit, ht: whatsappNumberHealth.tierLabel, hf: whatsappNumberHealth.flaggedAt, hl: whatsappNumberHealth.lastEventAt,
  }).from(whatsappConnections)
    .innerJoin(orgs, eq(orgs.id, whatsappConnections.orgId))
    .leftJoin(whatsappNumberHealth, eq(whatsappNumberHealth.orgId, whatsappConnections.orgId));
  return rows.map((r) => ({
    orgId: r.orgId, orgName: r.orgName, status: r.status, displayPhone: r.displayPhone, verifiedName: r.verifiedName, verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    health: r.hs ? { quality: r.hq as NumberHealth["quality"], status: r.hs as NumberHealth["status"], dailyLimit: r.hd ?? -1, tierLabel: r.ht ?? null, displayPhone: r.displayPhone, flaggedAt: r.hf ? r.hf.toISOString() : null, lastEventAt: r.hl ? r.hl.toISOString() : null } : null,
  }));
}
