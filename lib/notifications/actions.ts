"use server";

import { requireAuth } from "@/lib/auth/guard";
import { listNotifications, unreadNotificationCount, markNotificationsRead, type NotificationItem } from "@/db/queries/notifications";

/**
 * The bell fetches its own data (Phase 17.2) so it stays real without threading
 * props through every layout. DB-only; in mock/dev it returns empty (never throws).
 */
export async function fetchNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  if (process.env.DATA_PROVIDER !== "db") return { items: [], unread: 0 };
  try {
    const principal = await requireAuth();
    const [items, unread] = await Promise.all([
      listNotifications(principal.userId),
      unreadNotificationCount(principal.userId),
    ]);
    return { items, unread };
  } catch {
    return { items: [], unread: 0 };
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  if (process.env.DATA_PROVIDER !== "db") return;
  try {
    const principal = await requireAuth();
    await markNotificationsRead(principal.userId);
  } catch {
    /* ignore */
  }
}
