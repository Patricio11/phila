import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications, counsellors } from "@/db/schema";
import { user } from "@/db/auth-schema";

/** In-app notifications (the bell)  always-on, no external dependency (Phase 17.2). */

export interface NewNotification {
  userId: string;
  orgId?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  unread: boolean;
  createdAt: string;
}

export async function createNotification(n: NewNotification): Promise<void> {
  try {
    await getDb().insert(notifications).values({
      userId: n.userId, orgId: n.orgId ?? null, kind: n.kind, title: n.title,
      body: n.body ?? null, href: n.href ?? null, createdAt: new Date(),
    });
  } catch {
    /* a notification must never break the action that triggered it */
  }
}

/** Notify the user behind a counsellor record. */
export async function notifyCounsellor(counsellorId: string, n: Omit<NewNotification, "userId" | "orgId">): Promise<void> {
  const [c] = await getDb().select({ userId: counsellors.userId, orgId: counsellors.orgId }).from(counsellors).where(eq(counsellors.id, counsellorId)).limit(1);
  if (c) await createNotification({ userId: c.userId, orgId: c.orgId, ...n });
}

/** Notify the user behind a client record, if the client has a portal account. */
export async function notifyClientUser(clientId: string, orgId: string, n: Omit<NewNotification, "userId" | "orgId">): Promise<void> {
  const [u] = await getDb().select({ id: user.id }).from(user).where(eq(user.clientId, clientId)).limit(1);
  if (u) await createNotification({ userId: u.id, orgId, ...n });
}

export async function listNotifications(userId: string, limit = 15): Promise<NotificationItem[]> {
  const rows = await getDb().select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
  return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, unread: r.readAt === null, createdAt: r.createdAt.toISOString() }));
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  const rows = await getDb().select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.length;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await getDb().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
