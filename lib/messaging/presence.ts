import "server-only";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { userPresence } from "@/db/schema";

/**
 * Phase 34.2 - server-side presence. The shell heartbeats every 60 s while a
 * tab is visible; "online" = seen within ONLINE_MS. This is the truth for
 * "don't ring their phone, they're already here" - the Supabase presence dot
 * in the chat is a different job (live UI), so the two stay separate.
 */
export const ONLINE_MS = 2 * 60 * 1000;

/** Pure - unit-tested boundary. */
export function isOnlineAt(lastSeenAt: Date | string | null | undefined, now: Date | string): boolean {
  if (!lastSeenAt) return false;
  const seen = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return at - seen < ONLINE_MS;
}

export async function touchPresence(userId: string): Promise<void> {
  const now = new Date();
  await getDb().insert(userPresence).values({ userId, lastSeenAt: now })
    .onConflictDoUpdate({ target: userPresence.userId, set: { lastSeenAt: now } });
}

/** Which of these users are online right now. */
export async function onlineSet(userIds: string[], now = new Date()): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await getDb().select({ userId: userPresence.userId, at: userPresence.lastSeenAt })
    .from(userPresence).where(inArray(userPresence.userId, userIds));
  return new Set(rows.filter((r) => isOnlineAt(r.at, now)).map((r) => r.userId));
}

/** Prune stale rows occasionally (kept tiny; called from the heartbeat 1-in-50). */
export async function prunePresence(): Promise<void> {
  await getDb().execute(sql`delete from user_presence where last_seen_at < now() - interval '7 days'`);
}
