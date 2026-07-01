import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { messageThreads, threadMembers, teamMessages, orgMembers } from "@/db/schema";
import { user } from "@/db/auth-schema";
import type { TeamMessage, TeamThread } from "@/lib/data-provider";
import type { TeamRole } from "@/lib/domain/enums";

type Db = ReturnType<typeof getDb>;

/** The user's threads in an org  direct + group  with messages, unread, and the
 * other member's name/role (direct). Sorted by most-recent activity. */
export async function listTeamThreadsDb(userId: string, orgId: string): Promise<TeamThread[]> {
  const db = getDb();
  const memberships = await db
    .select({ threadId: threadMembers.threadId, lastReadAt: threadMembers.lastReadAt })
    .from(threadMembers)
    .where(and(eq(threadMembers.userId, userId), eq(threadMembers.orgId, orgId)));
  if (!memberships.length) return [];
  const threadIds = memberships.map((m) => m.threadId);
  const lastReadByThread = new Map(memberships.map((m) => [m.threadId, m.lastReadAt]));

  const [threads, members, roles, msgs] = await Promise.all([
    db.select().from(messageThreads).where(inArray(messageThreads.id, threadIds)),
    db.select({ threadId: threadMembers.threadId, userId: threadMembers.userId, name: user.name })
      .from(threadMembers).innerJoin(user, eq(threadMembers.userId, user.id))
      .where(inArray(threadMembers.threadId, threadIds)),
    db.select({ userId: orgMembers.userId, role: orgMembers.teamRole }).from(orgMembers).where(eq(orgMembers.orgId, orgId)),
    db.select().from(teamMessages).where(inArray(teamMessages.threadId, threadIds)).orderBy(teamMessages.createdAt),
  ]);

  const roleByUser = new Map(roles.map((r) => [r.userId, r.role as TeamRole]));
  const msgsByThread = new Map<string, typeof msgs>();
  for (const m of msgs) {
    const arr = msgsByThread.get(m.threadId);
    if (arr) arr.push(m);
    else msgsByThread.set(m.threadId, [m]);
  }
  const membersByThread = new Map<string, { userId: string; name: string }[]>();
  for (const mm of members) {
    const arr = membersByThread.get(mm.threadId);
    if (arr) arr.push({ userId: mm.userId, name: mm.name });
    else membersByThread.set(mm.threadId, [{ userId: mm.userId, name: mm.name }]);
  }
  const nameByUser = new Map(members.map((mm) => [mm.userId, mm.name]));

  const result: TeamThread[] = threads.map((t) => {
    const tMsgs = msgsByThread.get(t.id) ?? [];
    const tMembers = membersByThread.get(t.id) ?? [];
    const other = tMembers.find((m) => m.userId !== userId);
    const lastRead = lastReadByThread.get(t.id) ?? null;
    const unread = tMsgs.filter((m) => m.senderUserId !== userId && (!lastRead || m.createdAt > lastRead)).length;
    const isGroup = t.kind === "group";
    const messages: TeamMessage[] = tMsgs.map((m) => ({
      id: m.id, from: m.senderUserId === userId ? "me" : "them",
      text: m.deletedAt ? "" : m.body, at: m.createdAt.toISOString(),
      senderName: isGroup && m.senderUserId !== userId ? nameByUser.get(m.senderUserId) : undefined,
      edited: Boolean(m.editedAt), deleted: Boolean(m.deletedAt),
      attachment: m.attachmentKey && !m.deletedAt
        ? { name: m.attachmentName ?? "file", contentType: m.attachmentType ?? "application/octet-stream", bytes: m.attachmentBytes ?? 0 }
        : undefined,
    }));
    return {
      id: t.id,
      kind: (t.kind === "group" ? "group" : "direct") as "direct" | "group",
      otherUserId: t.kind === "group" ? "" : other?.userId ?? "",
      otherName: t.kind === "group" ? t.title ?? "Group" : other?.name ?? "Team member",
      otherRole: (other ? roleByUser.get(other.userId) : undefined) ?? "counsellor",
      memberCount: t.kind === "group" ? tMembers.length : undefined,
      unread,
      lastAt: (t.lastMessageAt ?? t.createdAt).toISOString(),
      messages,
    };
  });
  result.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return result;
}

/** The stable key for a 1:1 thread: org-scoped, member-order-independent. */
export function directPairKey(orgId: string, a: string, b: string): string {
  return `${orgId}:${[a, b].sort().join(":")}`;
}

/** A direct thread shared by both users, or a freshly-created one. `created` is
 *  true only when a new thread was made  the recipient isn't subscribed to its
 *  realtime channel yet, so the caller must push them a `thread_added`.
 *
 *  One thread per pair is a DB guarantee via the unique `pair_key`: if two first
 *  messages race, the second insert hits the conflict and reuses the winner's
 *  thread (never a duplicate). */
async function findOrCreateDirectThread(db: Db, orgId: string, a: string, b: string): Promise<{ threadId: string; created: boolean }> {
  const pairKey = directPairKey(orgId, a, b);
  const [existing] = await db.select({ threadId: messageThreads.id }).from(messageThreads)
    .where(eq(messageThreads.pairKey, pairKey)).limit(1);
  if (existing) return { threadId: existing.threadId, created: false };

  const threadId = `mt_${randomUUID()}`;
  const now = new Date();
  const inserted = await db.insert(messageThreads)
    .values({ id: threadId, orgId, kind: "direct", title: null, pairKey, createdBy: a, createdAt: now, lastMessageAt: now })
    .onConflictDoNothing({ target: messageThreads.pairKey })
    .returning({ id: messageThreads.id });
  if (!inserted.length) {
    // Lost the create race  another request just made this thread. Reuse it.
    const [row] = await db.select({ threadId: messageThreads.id }).from(messageThreads)
      .where(eq(messageThreads.pairKey, pairKey)).limit(1);
    return { threadId: row?.threadId ?? threadId, created: false };
  }
  await db.insert(threadMembers).values([
    { orgId, threadId, userId: a, lastReadAt: now, joinedAt: now },
    { orgId, threadId, userId: b, lastReadAt: null, joinedAt: now },
  ]);
  return { threadId, created: true };
}

export interface SentMessage { threadId: string; messageId: string; createdAt: string; created?: boolean }
export interface ChatAttachment { key: string; name: string; contentType: string; bytes: number }

function attachmentCols(a?: ChatAttachment) {
  return {
    attachmentKey: a?.key ?? null,
    attachmentName: a?.name ?? null,
    attachmentType: a?.contentType ?? null,
    attachmentBytes: a?.bytes ?? null,
  };
}

/** Persist a direct message (find-or-create the 1:1 thread); returns the new row. */
export async function sendTeamMessageDb(orgId: string, fromUserId: string, toUserId: string, text: string, attachment?: ChatAttachment): Promise<SentMessage> {
  const db = getDb();
  const { threadId, created } = await findOrCreateDirectThread(db, orgId, fromUserId, toUserId);
  const messageId = `tm_${randomUUID()}`;
  const createdAt = new Date();
  await db.insert(teamMessages).values({ id: messageId, orgId, threadId, senderUserId: fromUserId, body: text, createdAt, ...attachmentCols(attachment) });
  await db.update(messageThreads).set({ lastMessageAt: createdAt }).where(eq(messageThreads.id, threadId));
  await db.update(threadMembers).set({ lastReadAt: createdAt }).where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, fromUserId)));
  return { threadId, messageId, createdAt: createdAt.toISOString(), created };
}

/** Create a named group thread with the creator + invited members. */
export async function createGroupThreadDb(orgId: string, createdBy: string, title: string, memberUserIds: string[]): Promise<string> {
  const db = getDb();
  const threadId = `mt_${randomUUID()}`;
  const now = new Date();
  await db.insert(messageThreads).values({ id: threadId, orgId, kind: "group", title, createdBy, createdAt: now, lastMessageAt: now });
  const ids = Array.from(new Set([createdBy, ...memberUserIds]));
  await db.insert(threadMembers).values(
    ids.map((userId) => ({ orgId, threadId, userId, lastReadAt: userId === createdBy ? now : null, joinedAt: now })),
  );
  return threadId;
}

/** True if the user is a member of the thread (in this org). */
async function isThreadMember(db: Db, orgId: string, threadId: string, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: threadMembers.id }).from(threadMembers)
    .where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, userId), eq(threadMembers.orgId, orgId))).limit(1);
  return Boolean(row);
}

/** Persist a message to an existing thread (group or direct)  sender must be a member. */
export async function sendToThreadDb(orgId: string, fromUserId: string, threadId: string, text: string, attachment?: ChatAttachment): Promise<SentMessage | null> {
  const db = getDb();
  if (!(await isThreadMember(db, orgId, threadId, fromUserId))) return null;
  const messageId = `tm_${randomUUID()}`;
  const createdAt = new Date();
  await db.insert(teamMessages).values({ id: messageId, orgId, threadId, senderUserId: fromUserId, body: text, createdAt, ...attachmentCols(attachment) });
  await db.update(messageThreads).set({ lastMessageAt: createdAt }).where(eq(messageThreads.id, threadId));
  await db.update(threadMembers).set({ lastReadAt: createdAt }).where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, fromUserId)));
  return { threadId, messageId, createdAt: createdAt.toISOString() };
}

/** Move a member's read cursor to now (clears unread). */
export async function markThreadReadDb(threadId: string, userId: string): Promise<void> {
  await getDb().update(threadMembers).set({ lastReadAt: new Date() })
    .where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, userId)));
}

/** The attachment's storage key + meta, but only if the user is a member of its thread. */
export async function getAttachmentAccess(messageId: string, userId: string): Promise<{ key: string; name: string; contentType: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ threadId: teamMessages.threadId, orgId: teamMessages.orgId, key: teamMessages.attachmentKey, name: teamMessages.attachmentName, type: teamMessages.attachmentType, deletedAt: teamMessages.deletedAt })
    .from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
  if (!row || !row.key || row.deletedAt) return null;
  if (!(await isThreadMember(db, row.orgId, row.threadId, userId))) return null;
  return { key: row.key, name: row.name ?? "file", contentType: row.type ?? "application/octet-stream" };
}

/** The thread ids a user is a member of (for scoping their realtime token's topics). */
export async function listMemberThreadIds(userId: string, orgId: string): Promise<string[]> {
  const rows = await getDb().select({ threadId: threadMembers.threadId }).from(threadMembers)
    .where(and(eq(threadMembers.userId, userId), eq(threadMembers.orgId, orgId)));
  return rows.map((r) => r.threadId);
}

/** A user's display name (for the realtime broadcast's senderName). */
export async function getUserName(userId: string): Promise<string> {
  const [row] = await getDb().select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  return row?.name ?? "Someone";
}

/** Edit one's own message (author-only). Returns the thread id for the live update, or null. */
export async function editMessageDb(messageId: string, userId: string, text: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db.select({ threadId: teamMessages.threadId, sender: teamMessages.senderUserId, deletedAt: teamMessages.deletedAt })
    .from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
  if (!row || row.sender !== userId || row.deletedAt) return null;
  await db.update(teamMessages).set({ body: text, editedAt: new Date() }).where(eq(teamMessages.id, messageId));
  return row.threadId;
}

/** Soft-delete one's own message (author-only). Returns the thread id, or null. */
export async function deleteMessageDb(messageId: string, userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db.select({ threadId: teamMessages.threadId, sender: teamMessages.senderUserId })
    .from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
  if (!row || row.sender !== userId) return null;
  await db.update(teamMessages).set({ deletedAt: new Date() }).where(eq(teamMessages.id, messageId));
  return row.threadId;
}
