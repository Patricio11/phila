import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { supervisionClasses, supervisionClassMembers, supervisionClassPosts, supervisionClassSessions, supervisionClassAttendance, counsellors } from "@/db/schema";

/**
 * Supervision classrooms (batch 2) - a class per supervisor, Classroom-style:
 * the org creates it, the supervisor's supervisees are auto-rostered, everyone
 * in it shares a stream. No clinical content lives here (notes stay in
 * supervision sign-off); this is the teaching/announcement space.
 */

export interface ClassSummary {
  id: string;
  name: string;
  description: string | null;
  code: string;
  supervisorId: string;
  supervisorName: string;
  members: { counsellorId: string; name: string }[];
  postCount: number;
  lastPostAt: string | null;
}

export interface ClassPost {
  id: string;
  authorUserId: string;
  authorName: string;
  isSupervisor: boolean;
  /** Posted by the practice (org admin) - badged "Practice" in the stream. */
  isOrg: boolean;
  body: string;
  createdAt: string;
}

export interface ClassView extends ClassSummary {
  posts: ClassPost[];
}

const newCode = () => randomBytes(5).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 7).padEnd(7, "x");

/** Create a classroom; the supervisor's current supervisees join automatically. */
export async function createClassDb(orgId: string, input: { name: string; description?: string | null; supervisorId: string }): Promise<{ id: string; code: string; members: number }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const code = newCode();
    const [cls] = await db.insert(supervisionClasses)
      .values({ orgId, supervisorId: input.supervisorId, name: input.name, description: input.description ?? null, code })
      .returning({ id: supervisionClasses.id });
    const supervisees = await db.select({ id: counsellors.id }).from(counsellors)
      .where(and(eq(counsellors.orgId, orgId), eq(counsellors.supervisorId, input.supervisorId)));
    if (supervisees.length > 0) {
      await db.insert(supervisionClassMembers).values(supervisees.map((s) => ({ orgId, classId: cls!.id, counsellorId: s.id })));
    }
    return { id: cls!.id, code, members: supervisees.length };
  });
}

async function summarise(orgId: string, classes: (typeof supervisionClasses.$inferSelect)[]): Promise<ClassSummary[]> {
  const db = activeDb();
  if (classes.length === 0) return [];
  const ids = classes.map((c) => c.id);
  const [memberRows, counsellorRows, postRows] = await Promise.all([
    db.select().from(supervisionClassMembers).where(inArray(supervisionClassMembers.classId, ids)),
    db.select({ id: counsellors.id, name: counsellors.name }).from(counsellors).where(eq(counsellors.orgId, orgId)),
    db.select({ classId: supervisionClassPosts.classId, createdAt: supervisionClassPosts.createdAt }).from(supervisionClassPosts).where(inArray(supervisionClassPosts.classId, ids)),
  ]);
  const nameOf = new Map(counsellorRows.map((c) => [c.id, c.name]));
  return classes.map((c) => {
    const members = memberRows.filter((m) => m.classId === c.id).map((m) => ({ counsellorId: m.counsellorId, name: nameOf.get(m.counsellorId) ?? "Counsellor" }));
    const posts = postRows.filter((p) => p.classId === c.id);
    const last = posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      id: c.id, name: c.name, description: c.description, code: c.code,
      supervisorId: c.supervisorId, supervisorName: nameOf.get(c.supervisorId) ?? "Supervisor",
      members, postCount: posts.length, lastPostAt: last ? last.createdAt.toISOString() : null,
    };
  });
}

/** Every classroom in the org (the hub view). */
export async function listClassesDb(orgId: string): Promise<ClassSummary[]> {
  return runForOrg(orgId, async () => {
    const classes = await activeDb().select().from(supervisionClasses).where(eq(supervisionClasses.orgId, orgId));
    const sums = await summarise(orgId, classes);
    return sums.sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** The classrooms this counsellor belongs to (as supervisor or member), streams included. */
export async function classesForCounsellorDb(orgId: string, counsellorId: string): Promise<ClassView[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const memberOf = await db.select({ classId: supervisionClassMembers.classId }).from(supervisionClassMembers)
      .where(and(eq(supervisionClassMembers.orgId, orgId), eq(supervisionClassMembers.counsellorId, counsellorId)));
    const classes = await db.select().from(supervisionClasses).where(eq(supervisionClasses.orgId, orgId));
    const mine = classes.filter((c) => c.supervisorId === counsellorId || memberOf.some((m) => m.classId === c.id));
    const sums = await summarise(orgId, mine);
    if (mine.length === 0) return [];
    const postRows = await db.select().from(supervisionClassPosts)
      .where(inArray(supervisionClassPosts.classId, mine.map((c) => c.id)))
      .orderBy(desc(supervisionClassPosts.createdAt));
    return sums.map((s) => ({
      ...s,
      posts: postRows.filter((p) => p.classId === s.id).slice(0, 30)
        .map((p) => ({ id: p.id, authorUserId: p.authorUserId, authorName: p.authorName, isSupervisor: p.isSupervisor, isOrg: p.isOrg, body: p.body, createdAt: p.createdAt.toISOString() })),
    }));
  });
}

/**
 * Every classroom WITH its stream - the org's full view (batch 2e). The
 * practice sees everything: every post, every session, every class.
 */
export async function listClassStreamsForOrgDb(orgId: string): Promise<ClassView[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const classes = await db.select().from(supervisionClasses).where(eq(supervisionClasses.orgId, orgId));
    const sums = await summarise(orgId, classes);
    if (classes.length === 0) return [];
    const postRows = await db.select().from(supervisionClassPosts)
      .where(inArray(supervisionClassPosts.classId, classes.map((c) => c.id)))
      .orderBy(desc(supervisionClassPosts.createdAt));
    return sums
      .map((s) => ({
        ...s,
        posts: postRows.filter((p) => p.classId === s.id).slice(0, 30)
          .map((p) => ({ id: p.id, authorUserId: p.authorUserId, authorName: p.authorName, isSupervisor: p.isSupervisor, isOrg: p.isOrg, body: p.body, createdAt: p.createdAt.toISOString() })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/**
 * Post to a class stream. Author must be the supervisor or a member - or the
 * PRACTICE itself (`isOrg`, batch 2e): the org admin can always post (a stand-in
 * when the supervisor is away), badged "Practice". Returns who to notify.
 */
export async function postToClassDb(
  orgId: string,
  classId: string,
  author: { userId: string; counsellorId: string | null; name: string; isOrg?: boolean },
  body: string,
): Promise<{ ok: boolean; className?: string; notifyCounsellorIds?: string[] }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [cls] = await db.select().from(supervisionClasses).where(and(eq(supervisionClasses.id, classId), eq(supervisionClasses.orgId, orgId))).limit(1);
    if (!cls) return { ok: false };
    const members = await db.select().from(supervisionClassMembers).where(eq(supervisionClassMembers.classId, classId));
    const isSupervisor = !author.isOrg && cls.supervisorId === author.counsellorId;
    const isMember = !author.isOrg && members.some((m) => m.counsellorId === author.counsellorId);
    if (!author.isOrg && !isSupervisor && !isMember) return { ok: false };

    await db.insert(supervisionClassPosts).values({
      orgId, classId, authorUserId: author.userId, authorName: author.name, isSupervisor, isOrg: Boolean(author.isOrg), body,
    });
    const notify = [...new Set([cls.supervisorId, ...members.map((m) => m.counsellorId)])].filter((id) => id !== author.counsellorId);
    return { ok: true, className: cls.name, notifyCounsellorIds: notify };
  });
}

/** Add / remove a member (hub-managed roster changes). */
export async function setClassMemberDb(orgId: string, classId: string, counsellorId: string, present: boolean): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [cls] = await db.select({ id: supervisionClasses.id }).from(supervisionClasses)
      .where(and(eq(supervisionClasses.id, classId), eq(supervisionClasses.orgId, orgId))).limit(1);
    if (!cls) return false;
    if (present) {
      const existing = await db.select({ id: supervisionClassMembers.id }).from(supervisionClassMembers)
        .where(and(eq(supervisionClassMembers.classId, classId), eq(supervisionClassMembers.counsellorId, counsellorId))).limit(1);
      if (!existing.length) await db.insert(supervisionClassMembers).values({ orgId, classId, counsellorId });
    } else {
      await db.delete(supervisionClassMembers)
        .where(and(eq(supervisionClassMembers.classId, classId), eq(supervisionClassMembers.counsellorId, counsellorId)));
    }
    return true;
  });
}

/* ---- Live class sessions + attendance (batch 2b) ---- */

export interface ClassSessionView {
  id: string;
  classId: string;
  title: string;
  startsAt: string;
  durationMin: number;
  mode: "online" | "in_person";
  location: string | null;
  /** counsellorId → status; empty = attendance not marked yet. */
  attendance: Record<string, "present" | "absent">;
}

/**
 * Schedule a session - or a weekly RUN of them (`repeat`, batch 2e): one call
 * books the same slot for N weeks, so nobody re-creates the session every time.
 * Returns the class + roster so the caller can notify (once, not N times).
 */
export async function scheduleClassSessionDb(
  orgId: string,
  input: { classId: string; title: string; startsAt: Date; durationMin: number; mode: "online" | "in_person"; location?: string | null; createdByUserId: string; repeat?: number },
): Promise<{ ok: boolean; id?: string; count?: number; lastStartsAt?: Date; className?: string; notifyCounsellorIds?: string[] }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [cls] = await db.select().from(supervisionClasses).where(and(eq(supervisionClasses.id, input.classId), eq(supervisionClasses.orgId, orgId))).limit(1);
    if (!cls) return { ok: false };
    const count = Math.max(1, Math.min(12, input.repeat ?? 1));
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // SAST has no DST - wall-clock time holds
    const rows = Array.from({ length: count }, (_, i) => ({
      orgId, classId: input.classId, title: input.title,
      startsAt: new Date(input.startsAt.getTime() + WEEK_MS * i),
      durationMin: input.durationMin, mode: input.mode, location: input.location ?? null,
      createdByUserId: input.createdByUserId,
    }));
    const inserted = await db.insert(supervisionClassSessions).values(rows).returning({ id: supervisionClassSessions.id });
    const members = await db.select().from(supervisionClassMembers).where(eq(supervisionClassMembers.classId, input.classId));
    return {
      ok: true, id: inserted[0]!.id, count, lastStartsAt: rows[rows.length - 1]!.startsAt, className: cls.name,
      notifyCounsellorIds: [...new Set([cls.supervisorId, ...members.map((m) => m.counsellorId)])],
    };
  });
}

/** Sessions for a set of classes (streams show upcoming + recent past). */
export async function sessionsForClassesDb(orgId: string, classIds: string[]): Promise<ClassSessionView[]> {
  if (classIds.length === 0) return [];
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const rows = await db.select().from(supervisionClassSessions)
      .where(and(eq(supervisionClassSessions.orgId, orgId), inArray(supervisionClassSessions.classId, classIds)));
    const att = rows.length
      ? await db.select().from(supervisionClassAttendance).where(inArray(supervisionClassAttendance.sessionId, rows.map((r) => r.id)))
      : [];
    return rows
      .map((r): ClassSessionView => ({
        id: r.id, classId: r.classId, title: r.title, startsAt: r.startsAt.toISOString(),
        durationMin: r.durationMin, mode: r.mode as "online" | "in_person", location: r.location,
        attendance: Object.fromEntries(att.filter((a) => a.sessionId === r.id).map((a) => [a.counsellorId, a.status as "present" | "absent"])),
      }))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  });
}

/** One session + its class (the video-room page + token API load this). */
export async function classSessionDb(orgId: string | null, sessionId: string) {
  const { getDb } = await import("@/db/client");
  const db = getDb(); // owner read: the room page authorises by org membership itself
  const [s] = await db.select().from(supervisionClassSessions).where(eq(supervisionClassSessions.id, sessionId)).limit(1);
  if (!s || (orgId && s.orgId !== orgId)) return null;
  const [cls] = await db.select().from(supervisionClasses).where(eq(supervisionClasses.id, s.classId)).limit(1);
  const members = await db.select().from(supervisionClassMembers).where(eq(supervisionClassMembers.classId, s.classId));
  return cls ? { session: s, cls, memberIds: members.map((m) => m.counsellorId) } : null;
}

/** Replace the attendance register for a session (supervisor marks it). */
export async function markAttendanceDb(
  orgId: string,
  sessionId: string,
  marks: { counsellorId: string; status: "present" | "absent" }[],
): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [s] = await db.select({ id: supervisionClassSessions.id }).from(supervisionClassSessions)
      .where(and(eq(supervisionClassSessions.id, sessionId), eq(supervisionClassSessions.orgId, orgId))).limit(1);
    if (!s) return false;
    await db.delete(supervisionClassAttendance).where(eq(supervisionClassAttendance.sessionId, sessionId));
    if (marks.length > 0) {
      await db.insert(supervisionClassAttendance).values(marks.map((m) => ({ orgId, sessionId, counsellorId: m.counsellorId, status: m.status })));
    }
    return true;
  });
}

/** Per-member attendance across a class's PAST sessions (org + supervisor oversight). */
export async function classAttendanceSummaryDb(orgId: string, classId: string, nowISO: string): Promise<{ counsellorId: string; present: number; marked: number }[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const sessions = await db.select().from(supervisionClassSessions)
      .where(and(eq(supervisionClassSessions.classId, classId), eq(supervisionClassSessions.orgId, orgId)));
    const past = sessions.filter((s) => s.startsAt.getTime() < new Date(nowISO).getTime()).map((s) => s.id);
    if (!past.length) return [];
    const att = await db.select().from(supervisionClassAttendance).where(inArray(supervisionClassAttendance.sessionId, past));
    const by = new Map<string, { present: number; marked: number }>();
    for (const a of att) {
      const agg = by.get(a.counsellorId) ?? { present: 0, marked: 0 };
      agg.marked += 1;
      if (a.status === "present") agg.present += 1;
      by.set(a.counsellorId, agg);
    }
    return [...by.entries()].map(([counsellorId, v]) => ({ counsellorId, ...v }));
  });
}

/* ---- Edits (batch 2d) - fix what you wrote wrong ---- */

/** Update a classroom's details (org-managed). Changing supervisor keeps the roster. */
export async function updateClassDb(
  orgId: string,
  classId: string,
  input: { name: string; description: string | null; supervisorId: string },
): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(supervisionClasses)
      .set({ name: input.name, description: input.description, supervisorId: input.supervisorId })
      .where(and(eq(supervisionClasses.id, classId), eq(supervisionClasses.orgId, orgId)))
      .returning({ id: supervisionClasses.id });
    return res.length > 0;
  });
}

/** Edit your OWN post (author-only; keeps it honest and simple). */
export async function updateClassPostDb(orgId: string, postId: string, authorUserId: string, body: string): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(supervisionClassPosts)
      .set({ body })
      .where(and(eq(supervisionClassPosts.id, postId), eq(supervisionClassPosts.orgId, orgId), eq(supervisionClassPosts.authorUserId, authorUserId)))
      .returning({ id: supervisionClassPosts.id });
    return res.length > 0;
  });
}

/** Delete your OWN post. */
export async function deleteClassPostDb(orgId: string, postId: string, authorUserId: string): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().delete(supervisionClassPosts)
      .where(and(eq(supervisionClassPosts.id, postId), eq(supervisionClassPosts.orgId, orgId), eq(supervisionClassPosts.authorUserId, authorUserId)))
      .returning({ id: supervisionClassPosts.id });
    return res.length > 0;
  });
}
