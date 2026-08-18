"use server";

import { requireMessagingPrincipal } from "@/lib/messaging/principal";
import { unreadMessageCountDb } from "@/db/queries/messages";

/**
 * Batch 2u - the nav badge's number: unread team messages, org-wide for this
 * person. Any member may ask about their own unread; it leaks nothing else.
 */
export async function getUnreadMessages(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const me = await requireMessagingPrincipal();
  if (process.env.DATA_PROVIDER !== "db") return { ok: true, count: 0 };
  const count = await unreadMessageCountDb(me.userId, me.orgId);
  return { ok: true, count };
}
