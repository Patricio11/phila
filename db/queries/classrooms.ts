import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { supervisionClasses, supervisionClassMembers, supervisionClassPosts, counsellors } from "@/db/schema";

/**
 * Supervision classrooms (batch 2) — a class per supervisor, Classroom-style:
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
  authorName: string;
  isSupervisor: boolean;
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
        .map((p) => ({ id: p.id, authorName: p.authorName, isSupervisor: p.isSupervisor, body: p.body, createdAt: p.createdAt.toISOString() })),
    }));
  });
}

/** Post to a class stream. Author must be the supervisor or a member. Returns who to notify. */
export async function postToClassDb(
  orgId: string,
  classId: string,
  author: { userId: string; counsellorId: string; name: string },
  body: string,
): Promise<{ ok: boolean; className?: string; notifyCounsellorIds?: string[] }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [cls] = await db.select().from(supervisionClasses).where(and(eq(supervisionClasses.id, classId), eq(supervisionClasses.orgId, orgId))).limit(1);
    if (!cls) return { ok: false };
    const members = await db.select().from(supervisionClassMembers).where(eq(supervisionClassMembers.classId, classId));
    const isSupervisor = cls.supervisorId === author.counsellorId;
    const isMember = members.some((m) => m.counsellorId === author.counsellorId);
    if (!isSupervisor && !isMember) return { ok: false };

    await db.insert(supervisionClassPosts).values({
      orgId, classId, authorUserId: author.userId, authorName: author.name, isSupervisor, body,
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
