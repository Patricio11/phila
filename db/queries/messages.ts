import "server-only";
import type { StorageBackend } from "@/lib/domain/enums";
import { and, eq, inArray, sql } from "drizzle-orm";
import { sanitiseMentions } from "@/lib/messaging/mentions";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { activeDb } from "@/lib/db/scoped";
import { messageThreads, threadMembers, teamMessages, teamMessageReactions, orgMembers, clients, counsellors, orgs } from "@/db/schema";
import { user } from "@/db/auth-schema";
import type { TeamMessage, TeamThread } from "@/lib/data-provider";
import type { TeamRole } from "@/lib/domain/enums";

type Db = ReturnType<typeof getDb>;

/** The user's threads in an org  direct + group  with messages, unread, and the
 * other member's name/role (direct). Sorted by most-recent activity. */
export async function listTeamThreadsDb(userId: string, orgId: string): Promise<TeamThread[]> {
  const db = activeDb();
  // Phase 34.1 - practice <-> client threads: the practice side is derived from
  // role / caseload, so a member row is created the first time someone who
  // qualifies looks (a new admin sees every client thread without a migration).
  await ensureClientThreadMembershipsDb(orgId, userId);
  const memberships = await db
    .select({ threadId: threadMembers.threadId, lastReadAt: threadMembers.lastReadAt })
    .from(threadMembers)
    .where(and(eq(threadMembers.userId, userId), eq(threadMembers.orgId, orgId)));
  if (!memberships.length) return [];
  const threadIds = memberships.map((m) => m.threadId);
  const lastReadByThread = new Map(memberships.map((m) => [m.threadId, m.lastReadAt]));

  const [threads, members, roles, msgs, clientRows, orgRow] = await Promise.all([
    db.select().from(messageThreads).where(inArray(messageThreads.id, threadIds)),
    db.select({ threadId: threadMembers.threadId, userId: threadMembers.userId, name: user.name })
      .from(threadMembers).innerJoin(user, eq(threadMembers.userId, user.id))
      .where(inArray(threadMembers.threadId, threadIds)),
    db.select({ userId: orgMembers.userId, role: orgMembers.teamRole }).from(orgMembers).where(eq(orgMembers.orgId, orgId)),
    db.select().from(teamMessages).where(inArray(teamMessages.threadId, threadIds)).orderBy(teamMessages.createdAt),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.orgId, orgId)),
    db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
  ]);
  const clientNameById = new Map(clientRows.map((c) => [c.id, c.name]));
  const orgName = orgRow[0]?.name ?? "Your practice";
  // Batch 4g - reactions for every message shown, grouped per message + emoji.
  const msgIds = msgs.map((m) => m.id);
  const reactionRows = msgIds.length
    ? await db.select({ messageId: teamMessageReactions.messageId, userId: teamMessageReactions.userId, emoji: teamMessageReactions.emoji, at: teamMessageReactions.createdAt })
        .from(teamMessageReactions).where(inArray(teamMessageReactions.messageId, msgIds)).orderBy(teamMessageReactions.createdAt)
    : [];
  const reactionsByMsg = new Map<string, { emoji: string; userIds: string[] }[]>();
  for (const r of reactionRows) {
    const list = reactionsByMsg.get(r.messageId) ?? [];
    const hit = list.find((x) => x.emoji === r.emoji);
    if (hit) hit.userIds.push(r.userId);
    else list.push({ emoji: r.emoji, userIds: [r.userId] });
    reactionsByMsg.set(r.messageId, list);
  }
  const msgById = new Map(msgs.map((m) => [m.id, m]));

  const roleByUser = new Map(roles.map((r) => [r.userId, r.role as TeamRole]));
  const clientUserIds = new Set<string>();
  {
    const memberIds = Array.from(new Set(members.map((m) => m.userId)));
    if (memberIds.length) {
      const rows = await db.select({ id: user.id, clientId: user.clientId }).from(user).where(inArray(user.id, memberIds));
      for (const r of rows) if (r.clientId) clientUserIds.add(r.id);
    }
  }
  const amClient = clientUserIds.has(userId);
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
    const isClientThread = t.kind === "client";
    const messages: TeamMessage[] = tMsgs.map((m) => {
      const quoted = m.replyToId ? msgById.get(m.replyToId) : undefined;
      return {
        id: m.id, from: m.senderUserId === userId ? "me" : "them",
        text: m.deletedAt ? "" : m.body, at: m.createdAt.toISOString(),
        senderName: (isGroup || isClientThread) && m.senderUserId !== userId ? nameByUser.get(m.senderUserId) : undefined,
        senderId: m.senderUserId,
        edited: Boolean(m.editedAt), deleted: Boolean(m.deletedAt),
        attachment: m.attachmentKey && !m.deletedAt
          ? { name: m.attachmentName ?? "file", contentType: m.attachmentType ?? "application/octet-stream", bytes: m.attachmentBytes ?? 0 }
          : undefined,
        reactions: m.deletedAt ? undefined : reactionsByMsg.get(m.id),
        replyTo: quoted
          ? { id: quoted.id, senderName: quoted.senderUserId === userId ? "You" : (nameByUser.get(quoted.senderUserId) ?? "Team member"), text: quoted.deletedAt ? "Message deleted" : (quoted.body || (quoted.attachmentName ? `\u{1F4CE} ${quoted.attachmentName}` : "")) }
          : m.replyToId ? { id: m.replyToId, senderName: "Team member", text: "Message unavailable" } : null,
      };
    });
    // Phase 34.1 - a client thread reads differently from each side: staff see
    // the CLIENT'S name; the client sees the PRACTICE.
    const clientName = isClientThread ? (clientNameById.get(t.clientId ?? "") ?? "Client") : null;
    return {
      id: t.id,
      kind: (t.kind === "group" ? "group" : t.kind === "client" ? "client" : "direct") as "direct" | "group" | "client",
      otherUserId: t.kind === "group" || isClientThread ? "" : other?.userId ?? "",
      otherName: t.kind === "group" ? t.title ?? "Group" : isClientThread ? (amClient ? orgName : clientName!) : other?.name ?? "Team member",
      otherRole: (other ? roleByUser.get(other.userId) : undefined) ?? "counsellor",
      memberCount: t.kind === "group" ? tMembers.length : undefined,
      members: tMembers.map((m) => ({ userId: m.userId, name: m.name, role: clientUserIds.has(m.userId) ? "client" : (roleByUser.get(m.userId) ?? "counsellor") })),
      clientId: isClientThread ? t.clientId ?? undefined : undefined,
      clientName: isClientThread ? clientName ?? undefined : undefined,
      createdBy: t.createdBy ?? undefined,
      createdAt: t.createdAt.toISOString(),
      unread,
      lastAt: (t.lastMessageAt ?? t.createdAt).toISOString(),
      messages,
    };
  });
  result.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return result;
}

/* ── Phase 34.1 - practice <-> client threads ─────────────────────────────── */

export function clientPairKey(orgId: string, clientId: string): string {
  return `${orgId}:client:${clientId}`;
}

/** The staff who belong in a client's thread by role/caseload: every org admin +
 *  front desk, plus the client's primary counsellor. */
async function practiceMembersForClient(db: Db, orgId: string, clientId: string): Promise<string[]> {
  const [client] = await db.select({ primary: clients.primaryCounsellorId }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))).limit(1);
  const admins = await db.select({ userId: orgMembers.userId, role: orgMembers.teamRole }).from(orgMembers)
    .where(eq(orgMembers.orgId, orgId));
  const ids = new Set(admins.filter((m) => m.role === "org_admin" || m.role === "front_desk").map((m) => m.userId));
  if (client?.primary) {
    const [c] = await db.select({ userId: counsellors.userId }).from(counsellors)
      .where(and(eq(counsellors.id, client.primary), eq(counsellors.orgId, orgId))).limit(1);
    if (c) ids.add(c.userId);
  }
  return Array.from(ids);
}

/** Is this login a CLIENT's? (direct staff threads must never target one) */
export async function isClientUserDb(userId: string): Promise<boolean> {
  const [row] = await getDb().select({ clientId: user.clientId }).from(user).where(eq(user.id, userId)).limit(1);
  return Boolean(row?.clientId);
}

/** The client's login (if they've activated their space). */
export async function clientUserIdDb(clientId: string): Promise<string | null> {
  const [row] = await getDb().select({ id: user.id }).from(user).where(eq(user.clientId, clientId)).limit(1);
  return row?.id ?? null;
}

/**
 * Find or create THE thread between the practice and a client (DB-unique via
 * pair_key). Members: the qualifying staff + the client's user when they have
 * one. Returns null when the caller may not open it (a counsellor can only
 * message clients on their own caseload; admins / front desk any client).
 */
export async function findOrCreateClientThreadDb(
  orgId: string, byUserId: string, byRole: string, clientId: string,
): Promise<{ threadId: string; created: boolean } | null> {
  const db = getDb();
  const [client] = await db.select({ id: clients.id, primary: clients.primaryCounsellorId }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))).limit(1);
  if (!client) return null;
  if (byRole === "counsellor") {
    const mine = await db.select({ id: counsellors.id }).from(counsellors)
      .where(and(eq(counsellors.userId, byUserId), eq(counsellors.orgId, orgId)));
    if (!mine.some((c) => c.id === client.primary)) return null;
  } else if (byRole !== "org_admin" && byRole !== "front_desk") {
    return null;
  }

  const pairKey = clientPairKey(orgId, clientId);
  const [existing] = await db.select({ id: messageThreads.id }).from(messageThreads).where(eq(messageThreads.pairKey, pairKey)).limit(1);
  let threadId = existing?.id;
  let created = false;
  if (!threadId) {
    const id = `mt_${randomUUID()}`;
    const now = new Date();
    const inserted = await db.insert(messageThreads)
      .values({ id, orgId, kind: "client", title: null, pairKey, clientId, createdBy: byUserId, createdAt: now, lastMessageAt: now })
      .onConflictDoNothing({ target: messageThreads.pairKey })
      .returning({ id: messageThreads.id });
    if (inserted.length) { threadId = id; created = true; }
    else {
      const [row] = await db.select({ id: messageThreads.id }).from(messageThreads).where(eq(messageThreads.pairKey, pairKey)).limit(1);
      threadId = row?.id;
    }
  }
  if (!threadId) return null;

  // Membership: practice side + the client's user (if activated). Idempotent.
  const staff = await practiceMembersForClient(db, orgId, clientId);
  const clientUser = await clientUserIdDb(clientId);
  const now = new Date();
  const rows = Array.from(new Set([byUserId, ...staff, ...(clientUser ? [clientUser] : [])]))
    .map((userId) => ({ orgId, threadId: threadId!, userId, lastReadAt: userId === byUserId ? now : null, joinedAt: now }));
  if (rows.length) await db.insert(threadMembers).values(rows).onConflictDoNothing();
  return { threadId, created };
}

/**
 * Self-healing membership for client threads: whoever qualifies by role /
 * caseload (or IS the client) gets a member row for every client thread they
 * should see. Called on every list - cheap, idempotent, migration-free.
 */
export async function ensureClientThreadMembershipsDb(orgId: string, userId: string): Promise<void> {
  const db = getDb();
  const [me] = await db.select({ role: orgMembers.teamRole }).from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId))).limit(1);
  let threadIds: string[] = [];
  if (me && (me.role === "org_admin" || me.role === "front_desk")) {
    const rows = await db.select({ id: messageThreads.id }).from(messageThreads)
      .where(and(eq(messageThreads.orgId, orgId), eq(messageThreads.kind, "client")));
    threadIds = rows.map((r) => r.id);
  } else if (me && me.role === "counsellor") {
    const mine = await db.select({ id: counsellors.id }).from(counsellors)
      .where(and(eq(counsellors.userId, userId), eq(counsellors.orgId, orgId)));
    if (mine.length) {
      const myClients = await db.select({ id: clients.id }).from(clients)
        .where(and(eq(clients.orgId, orgId), inArray(clients.primaryCounsellorId, mine.map((c) => c.id))));
      if (myClients.length) {
        const rows = await db.select({ id: messageThreads.id }).from(messageThreads)
          .where(and(eq(messageThreads.orgId, orgId), eq(messageThreads.kind, "client"), inArray(messageThreads.clientId, myClients.map((c) => c.id))));
        threadIds = rows.map((r) => r.id);
      }
    }
  } else if (!me) {
    // A client: their own thread, if the practice has opened one.
    const [u] = await db.select({ clientId: user.clientId }).from(user).where(eq(user.id, userId)).limit(1);
    if (u?.clientId) {
      const rows = await db.select({ id: messageThreads.id }).from(messageThreads)
        .where(and(eq(messageThreads.orgId, orgId), eq(messageThreads.kind, "client"), eq(messageThreads.clientId, u.clientId)));
      threadIds = rows.map((r) => r.id);
    }
  }
  if (threadIds.length === 0) return;
  const have = await db.select({ threadId: threadMembers.threadId }).from(threadMembers)
    .where(and(eq(threadMembers.userId, userId), inArray(threadMembers.threadId, threadIds)));
  const has = new Set(have.map((h) => h.threadId));
  const missing = threadIds.filter((id) => !has.has(id));
  if (missing.length === 0) return;
  const now = new Date();
  await db.insert(threadMembers).values(missing.map((threadId) => ({ orgId, threadId, userId, lastReadAt: null, joinedAt: now }))).onConflictDoNothing();
}

/** Does the practice have a thread with this client yet? (drives the client's Messages nav) */
export async function clientHasThreadDb(clientId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: messageThreads.id }).from(messageThreads)
    .where(and(eq(messageThreads.kind, "client"), eq(messageThreads.clientId, clientId))).limit(1);
  return Boolean(row);
}

/** The thread's kind + client id (for the client-side rule checks). */
export async function threadKindDb(threadId: string): Promise<{ kind: string; clientId: string | null; orgId: string } | null> {
  const [row] = await getDb().select({ kind: messageThreads.kind, clientId: messageThreads.clientId, orgId: messageThreads.orgId })
    .from(messageThreads).where(eq(messageThreads.id, threadId)).limit(1);
  return row ?? null;
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
export interface ChatAttachment { key: string; name: string; contentType: string; bytes: number; backend?: StorageBackend }

function attachmentCols(a?: ChatAttachment) {
  return {
    attachmentKey: a?.key ?? null,
    attachmentBackend: a?.backend ?? "supabase",
    attachmentName: a?.name ?? null,
    attachmentType: a?.contentType ?? null,
    attachmentBytes: a?.bytes ?? null,
  };
}

/** Persist a direct message (find-or-create the 1:1 thread); returns the new row. */
export async function sendTeamMessageDb(orgId: string, fromUserId: string, toUserId: string, text: string, attachment?: ChatAttachment, replyToId?: string): Promise<SentMessage> {
  const db = getDb();
  const { threadId, created } = await findOrCreateDirectThread(db, orgId, fromUserId, toUserId);
  const messageId = `tm_${randomUUID()}`;
  const createdAt = new Date();
  await db.insert(teamMessages).values({ id: messageId, orgId, threadId, senderUserId: fromUserId, body: text, createdAt, replyToId: await validReplyTarget(db, threadId, replyToId), ...attachmentCols(attachment) });
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
export async function sendToThreadDb(orgId: string, fromUserId: string, threadId: string, text: string, attachment?: ChatAttachment, replyToId?: string): Promise<SentMessage | null> {
  const db = getDb();
  if (!(await isThreadMember(db, orgId, threadId, fromUserId))) return null;
  const messageId = `tm_${randomUUID()}`;
  const createdAt = new Date();
  await db.insert(teamMessages).values({ id: messageId, orgId, threadId, senderUserId: fromUserId, body: text, createdAt, replyToId: await validReplyTarget(db, threadId, replyToId), ...attachmentCols(attachment) });
  await db.update(messageThreads).set({ lastMessageAt: createdAt }).where(eq(messageThreads.id, threadId));
  await db.update(threadMembers).set({ lastReadAt: createdAt }).where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, fromUserId)));
  return { threadId, messageId, createdAt: createdAt.toISOString() };
}

/** Move a member's read cursor to now (clears unread). */
export async function markThreadReadDb(threadId: string, userId: string): Promise<void> {
  // Phase 34.2 - reading re-arms the alert (one alert per thread until read).
  await getDb().update(threadMembers).set({ lastReadAt: new Date(), nudgedAt: null })
    .where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, userId)));
}

/** The attachment's storage key + meta, but only if the user is a member of its thread. */
export async function getAttachmentAccess(messageId: string, userId: string): Promise<{ key: string; name: string; contentType: string; backend: StorageBackend } | null> {
  const db = getDb();
  const [row] = await db
    .select({ threadId: teamMessages.threadId, orgId: teamMessages.orgId, key: teamMessages.attachmentKey, backend: teamMessages.attachmentBackend, name: teamMessages.attachmentName, type: teamMessages.attachmentType, deletedAt: teamMessages.deletedAt })
    .from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
  if (!row || !row.key || row.deletedAt) return null;
  if (!(await isThreadMember(db, row.orgId, row.threadId, userId))) return null;
  return { key: row.key, name: row.name ?? "file", contentType: row.type ?? "application/octet-stream", backend: (row.backend ?? "supabase") as StorageBackend };
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
  // Batch 4n - a mention token must point at a member of this thread.
  const members = await db.select({ userId: threadMembers.userId }).from(threadMembers).where(eq(threadMembers.threadId, row.threadId));
  const body = sanitiseMentions(text, members.map((m) => ({ userId: m.userId, name: "" })));
  await db.update(teamMessages).set({ body, editedAt: new Date() }).where(eq(teamMessages.id, messageId));
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

/** A reply target counts only if it's a message in the SAME thread (no cross-thread quoting). */
async function validReplyTarget(db: Db, threadId: string, replyToId?: string): Promise<string | null> {
  if (!replyToId) return null;
  const [row] = await db.select({ id: teamMessages.id }).from(teamMessages)
    .where(and(eq(teamMessages.id, replyToId), eq(teamMessages.threadId, threadId))).limit(1);
  return row ? row.id : null;
}

/** The quoted message's display bits for a live broadcast (name resolved for the recipients). */
export async function quotedMessageDb(messageId: string): Promise<{ id: string; senderId: string; senderName: string; text: string } | null> {
  const db = getDb();
  const [m] = await db.select({ id: teamMessages.id, sender: teamMessages.senderUserId, body: teamMessages.body, deletedAt: teamMessages.deletedAt, attachmentName: teamMessages.attachmentName })
    .from(teamMessages).where(eq(teamMessages.id, messageId)).limit(1);
  if (!m) return null;
  const senderName = await getUserName(m.sender);
  return { id: m.id, senderId: m.sender, senderName, text: m.deletedAt ? "Message deleted" : (m.body || (m.attachmentName ? `\u{1F4CE} ${m.attachmentName}` : "")) };
}

/**
 * Batch 4g - toggle one's reaction on a message (members only). Returns the
 * thread id + whether it's now on, or null when the message isn't reachable.
 */
export async function toggleReactionDb(orgId: string, userId: string, messageId: string, emoji: string): Promise<{ threadId: string; added: boolean } | null> {
  const db = getDb();
  const [m] = await db.select({ threadId: teamMessages.threadId, deletedAt: teamMessages.deletedAt })
    .from(teamMessages).where(and(eq(teamMessages.id, messageId), eq(teamMessages.orgId, orgId))).limit(1);
  if (!m || m.deletedAt) return null;
  if (!(await isThreadMember(db, orgId, m.threadId, userId))) return null;
  const [existing] = await db.select({ id: teamMessageReactions.id }).from(teamMessageReactions)
    .where(and(eq(teamMessageReactions.messageId, messageId), eq(teamMessageReactions.userId, userId), eq(teamMessageReactions.emoji, emoji))).limit(1);
  if (existing) {
    await db.delete(teamMessageReactions).where(eq(teamMessageReactions.id, existing.id));
    return { threadId: m.threadId, added: false };
  }
  await db.insert(teamMessageReactions).values({ orgId, messageId, userId, emoji }).onConflictDoNothing();
  return { threadId: m.threadId, added: true };
}

/** Who may manage a group: its creator or an org admin. */
export async function canManageGroupDb(orgId: string, threadId: string, userId: string, teamRole: string): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const db = getDb();
  const [t] = await db.select({ kind: messageThreads.kind, createdBy: messageThreads.createdBy, title: messageThreads.title })
    .from(messageThreads).where(and(eq(messageThreads.id, threadId), eq(messageThreads.orgId, orgId))).limit(1);
  if (!t || t.kind !== "group") return { ok: false, error: "That group wasn't found." };
  if (!(await isThreadMember(db, orgId, threadId, userId))) return { ok: false, error: "You're not in that group." };
  if (t.createdBy !== userId && teamRole !== "org_admin") return { ok: false, error: "Only the group's creator or an org admin can change it." };
  return { ok: true, title: t.title ?? "Group" };
}

export async function renameGroupDb(threadId: string, title: string): Promise<void> {
  await getDb().update(messageThreads).set({ title }).where(eq(messageThreads.id, threadId));
}

/** Add teammates to a group (idempotent). Returns the ids actually added. */
export async function addGroupMembersDb(orgId: string, threadId: string, userIds: string[]): Promise<string[]> {
  const db = getDb();
  if (userIds.length === 0) return [];
  // Only real members of this org can join.
  const eligible = await db.select({ userId: orgMembers.userId }).from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), inArray(orgMembers.userId, userIds)));
  const ids = eligible.map((r) => r.userId);
  if (ids.length === 0) return [];
  const existing = await db.select({ userId: threadMembers.userId }).from(threadMembers)
    .where(and(eq(threadMembers.threadId, threadId), inArray(threadMembers.userId, ids)));
  const have = new Set(existing.map((r) => r.userId));
  const fresh = ids.filter((id) => !have.has(id));
  if (fresh.length === 0) return [];
  const now = new Date();
  await db.insert(threadMembers).values(fresh.map((userId) => ({ orgId, threadId, userId, lastReadAt: null, joinedAt: now }))).onConflictDoNothing();
  return fresh;
}

export async function removeGroupMemberDb(orgId: string, threadId: string, userId: string): Promise<boolean> {
  const res = await getDb().delete(threadMembers)
    .where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, userId), eq(threadMembers.orgId, orgId)))
    .returning({ id: threadMembers.id });
  return res.length > 0;
}

/** Everyone in a thread (name + role) - the group profile + broadcast fan-out. */
export async function threadMembersDb(orgId: string, threadId: string): Promise<{ userId: string; name: string; role: TeamRole }[]> {
  const db = getDb();
  const rows = await db.select({ userId: threadMembers.userId, name: user.name, role: orgMembers.teamRole })
    .from(threadMembers)
    .innerJoin(user, eq(threadMembers.userId, user.id))
    .leftJoin(orgMembers, and(eq(orgMembers.userId, threadMembers.userId), eq(orgMembers.orgId, orgId)))
    .where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.orgId, orgId)));
  return rows.map((r) => ({ userId: r.userId, name: r.name, role: (r.role ?? "counsellor") as TeamRole }));
}

/** Is this thread a group in this org, and is the user in it? (for Leave.) */
export async function groupMembershipDb(orgId: string, threadId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const [t] = await db.select({ kind: messageThreads.kind }).from(messageThreads)
    .where(and(eq(messageThreads.id, threadId), eq(messageThreads.orgId, orgId))).limit(1);
  if (!t || t.kind !== "group") return false;
  return isThreadMember(db, orgId, threadId, userId);
}

/**
 * Batch 2u - how many messages are waiting for this person, across every thread.
 * One number for the nav badge, so "you have unread messages" is visible from
 * anywhere rather than only on the Messages page.
 */
export async function unreadMessageCountDb(userId: string, orgId: string): Promise<number> {
  const db = getDb();
  const memberships = await db
    .select({ threadId: threadMembers.threadId, lastReadAt: threadMembers.lastReadAt })
    .from(threadMembers)
    .where(and(eq(threadMembers.userId, userId), eq(threadMembers.orgId, orgId)));
  if (memberships.length === 0) return 0;
  const ids = memberships.map((m) => m.threadId);
  const lastRead = new Map(memberships.map((m) => [m.threadId, m.lastReadAt]));
  const rows = await db
    .select({ threadId: teamMessages.threadId, senderUserId: teamMessages.senderUserId, createdAt: teamMessages.createdAt, deletedAt: teamMessages.deletedAt })
    .from(teamMessages)
    .where(inArray(teamMessages.threadId, ids));
  return rows.filter((m) => {
    if (m.deletedAt || m.senderUserId === userId) return false;
    const seen = lastRead.get(m.threadId);
    return !seen || m.createdAt > seen;
  }).length;
}

/* ── Batch 4m - typing over the database (works with or without Supabase) ── */

/** Stamp "I'm typing in this thread" (member rows only - a stranger can't). */
export async function stampTypingDb(threadId: string, userId: string): Promise<void> {
  await getDb().update(threadMembers).set({ typingAt: new Date() })
    .where(and(eq(threadMembers.threadId, threadId), eq(threadMembers.userId, userId)));
}

/** Who is typing right now (last 6 s) in any of MY threads, excluding me - names grouped by thread. One query. */
export async function typingNowDb(userId: string, orgId: string): Promise<Record<string, string[]>> {
  const db = getDb();
  const since = new Date(Date.now() - 6_000);
  const rows = await db.execute<{ thread_id: string; name: string }>(sql`
    select o.thread_id, u.name
    from thread_members me
    join thread_members o on o.thread_id = me.thread_id and o.user_id <> me.user_id
    join "user" u on u.id = o.user_id
    where me.user_id = ${userId} and me.org_id = ${orgId} and o.typing_at > ${since}
  `);
  const out: Record<string, string[]> = {};
  for (const r of rows.rows) (out[r.thread_id] ??= []).push(r.name);
  return out;
}
