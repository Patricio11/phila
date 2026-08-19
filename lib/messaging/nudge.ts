import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { messageThreads, threadMembers, clients, orgMembers, orgs, teamProfiles } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { getMessagingSettings } from "@/db/queries/messaging";
import { createNotification } from "@/db/queries/notifications";
import { onlineSet } from "@/lib/messaging/presence";
import { shouldAlert, shouldNudgeExternally } from "@/lib/messaging/nudge-rules";
import { deliver } from "@/lib/messaging/deliver";
import { logAccess } from "@/lib/audit";
import { pushToUsers } from "@/lib/push";

/**
 * Phase 34.2 - the doorbell. After a message is persisted, every OTHER member
 * of the thread gets: the in-app bell (once per thread until they read it) and,
 * if they're NOT online in Phila, ONE external "X sent you a message on Phila -
 * open it" over their preferred channel through the same deliver() chokepoint
 * every client notice uses (WhatsApp on the org's number, SMS/email from
 * credits; opt-out + quiet hours + metering apply). The nudge NEVER carries the
 * message body. A client with no portal login yet is alerted from their client
 * record with the activation link, once, until they activate.
 */
export async function nudgeThreadMembers(input: {
  threadId: string;
  orgId: string;
  senderUserId: string;
  senderName: string;
  messageId: string;
  /** Sender is a client (their reply) or staff. */
  senderKind: "staff" | "client";
  /** Batch 4n - people @mentioned in this message: they always hear, even if already alerted for the thread. */
  mentionedUserIds?: string[];
}): Promise<void> {
  const db = getDb();
  const [thread] = await db.select().from(messageThreads).where(and(eq(messageThreads.id, input.threadId), eq(messageThreads.orgId, input.orgId))).limit(1);
  if (!thread) return;
  const [settings, orgRow, members] = await Promise.all([
    getMessagingSettings(input.orgId),
    db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, input.orgId)).limit(1),
    db.select({ userId: threadMembers.userId, lastReadAt: threadMembers.lastReadAt, nudgedAt: threadMembers.nudgedAt })
      .from(threadMembers).where(eq(threadMembers.threadId, input.threadId)),
  ]);
  const practiceName = orgRow[0]?.name ?? "Your practice";
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const others = members.filter((m) => m.userId !== input.senderUserId);
  const now = new Date();
  const mentioned = new Set(input.mentionedUserIds ?? []);
  const due = (m: { userId: string; nudgedAt: Date | null; lastReadAt: Date | null }) => mentioned.has(m.userId) || shouldAlert({ nudgedAt: m.nudgedAt, lastReadAt: m.lastReadAt });

  // Who are they? (client logins vs staff + role, phone, email)
  const ids = others.map((m) => m.userId);
  const [users, roles, profiles, online] = ids.length
    ? await Promise.all([
        db.select({ id: user.id, name: user.name, email: user.email, clientId: user.clientId }).from(user).where(inArray(user.id, ids)),
        db.select({ userId: orgMembers.userId, role: orgMembers.teamRole }).from(orgMembers).where(and(eq(orgMembers.orgId, input.orgId), inArray(orgMembers.userId, ids))),
        db.select({ userId: teamProfiles.userId, phone: teamProfiles.phone }).from(teamProfiles).where(and(eq(teamProfiles.orgId, input.orgId), inArray(teamProfiles.userId, ids))),
        onlineSet(ids, now),
      ])
    : [[], [], [], new Set<string>()];
  const userById = new Map(users.map((u) => [u.id, u]));
  const roleByUser = new Map(roles.map((r) => [r.userId, r.role]));
  const phoneByUser = new Map(profiles.map((p) => [p.userId, p.phone]));
  const clientIds = users.map((u) => u.clientId).filter((c): c is string => Boolean(c));
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name, phone: clients.phone, email: clients.email, profile: clients.profile }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientById = new Map(clientRows.map((c) => [c.id, c]));

  const threadLabel = thread.kind === "group" ? (thread.title ?? "a group") : null;
  const senderLabel = threadLabel ? `${input.senderName} · ${threadLabel}` : input.senderName;

  // Batch 4m - web push first, for everyone who isn't online and is due an alert:
  // one card per conversation (replacing tag), never the text. Reached by push
  // counts like "online" - the external lane (WhatsApp / SMS / email) then stays quiet.
  const dueOffline = others.filter((m) => due(m) && !online.has(m.userId)).map((m) => m.userId);
  let pushed = new Set<string>();
  if (dueOffline.length) {
    try {
      const res = await pushToUsers(dueOffline, {
        title: threadLabel ? `${input.senderName} posted in ${threadLabel}` : `${input.senderName} sent you a message`,
        body: `On Phila · ${practiceName}. Open it to read.`,
        url: "/open/messages?t=" + encodeURIComponent(input.threadId),
        tag: `thread:${input.threadId}`,
      });
      pushed = res.reached;
      if (res.sent || res.pruned) await logAccess({ action: "admin.action", actor: { userId: "system:nudge", platformRole: null, teamRole: null }, orgId: input.orgId, target: `thread:${input.threadId}`, reason: `message_alert_push_${res.sent}_pruned_${res.pruned}` });
    } catch { /* push is best-effort; the other lanes still run */ }
  }

  // Members are independent - alert them concurrently (Neon round-trips add up).
  await Promise.all(others.map(async (m) => {
    if (!due(m)) return;
    const u = userById.get(m.userId);
    const isMention = mentioned.has(m.userId);
    if (!u) return;
    const isClient = Boolean(u.clientId);
    const role = roleByUser.get(m.userId) ?? "counsellor";
    const link = isClient
      ? `${base}/me/messages`
      : `${base}${role === "counsellor" ? "/app" : "/hub"}/messages?t=${encodeURIComponent(input.threadId)}`;

    // 1. The bell - always (once per thread until read).
    await createNotification({
      userId: m.userId,
      orgId: input.orgId,
      kind: "message",
      title: isMention
        ? (threadLabel ? `${input.senderName} mentioned you in ${threadLabel}` : `${input.senderName} mentioned you`)
        : (threadLabel ? `${input.senderName} posted in ${threadLabel}` : `${input.senderName} sent you a message`),
      body: "Open Messages to read it.",
      href: isClient ? "/me/messages" : `${role === "counsellor" ? "/app" : "/hub"}/messages?t=${encodeURIComponent(input.threadId)}`,
    });

    // 2. External - only when offline and the org allows it for this kind of person.
    const alertsOn = isClient ? settings.messageAlertsClients : settings.messageAlertsStaff;
    if (shouldNudgeExternally({ online: online.has(m.userId) || pushed.has(m.userId), alertsOn })) {
      const c = isClient ? clientById.get(u.clientId!) : null;
      const prof = (c?.profile as Record<string, string> | null) ?? null;
      const recipient = isClient
        ? { phone: c?.phone ?? null, email: c?.email ?? null, preferredContact: prof?.preferredContact ?? null }
        : { phone: phoneByUser.get(m.userId) ?? null, email: u.email ?? null, preferredContact: null };
      const firstName = (isClient ? c?.name : u.name)?.split(" ")[0] ?? "there";
      try {
        const out = await deliver({
          orgId: input.orgId,
          trigger: "new_message",
          ref: `nudge_${input.threadId}_${m.userId}_${input.messageId}`,
          recipient,
          vars: { clientName: firstName, practiceName, serviceName: "", counsellorName: senderLabel, date: "", time: "", senderName: senderLabel, link },
        });
        await logAccess({
          action: "admin.action",
          actor: { userId: "system:nudge", platformRole: null, teamRole: null },
          orgId: input.orgId,
          target: `thread:${input.threadId}/${m.userId}`,
          reason: `message_alert_${out.channel ?? "none"}_${out.status}`,
        });
      } catch { /* the message is delivered in Phila regardless */ }
    }
    await db.update(threadMembers).set({ nudgedAt: now })
      .where(and(eq(threadMembers.threadId, input.threadId), eq(threadMembers.userId, m.userId)));
  }));

  // 3. A client thread whose client has NO login yet: alert the client record with
  //    the activation link - once, until they activate (then the member row rule applies).
  if (thread.kind === "client" && thread.clientId && input.senderKind === "staff" && settings.messageAlertsClients) {
    const clientHasLogin = users.some((u) => u.clientId === thread.clientId);
    if (!clientHasLogin && !thread.clientNudgedAt) {
      const [c] = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, email: clients.email, profile: clients.profile })
        .from(clients).where(and(eq(clients.id, thread.clientId), eq(clients.orgId, input.orgId))).limit(1);
      if (c) {
        const prof = (c.profile as Record<string, string> | null) ?? null;
        const link = `${base}/activate?role=client&c=${encodeURIComponent(c.id)}`;
        try {
          const out = await deliver({
            orgId: input.orgId,
            trigger: "new_message",
            ref: `nudge_${input.threadId}_client_${input.messageId}`,
            recipient: { phone: c.phone, email: c.email, preferredContact: prof?.preferredContact ?? null },
            vars: { clientName: c.name.split(" ")[0] ?? "there", practiceName, serviceName: "", counsellorName: senderLabel, date: "", time: "", senderName: senderLabel, link },
          });
          await logAccess({ action: "admin.action", actor: { userId: "system:nudge", platformRole: null, teamRole: null }, orgId: input.orgId, target: `thread:${input.threadId}/client`, reason: `message_alert_${out.channel ?? "none"}_${out.status}` });
        } catch { /* honest skip */ }
        await db.update(messageThreads).set({ clientNudgedAt: now }).where(eq(messageThreads.id, input.threadId));
      }
    }
  }
}
