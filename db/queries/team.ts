import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { orgMembers, counsellors, clients, appointments, services, rooms, roomAssignments } from "@/db/schema";
import { user } from "@/db/auth-schema";
import type { TeamMemberView, TeamMemberDetail, MemberStatus, AppointmentView } from "@/lib/data-provider";
import type { TeamRole, CredentialBody, CredentialStatus, AppointmentState, AppointmentType } from "@/lib/domain/enums";

/**
 * Hub team management (W1.4). Real membership from `org_members` + `user` (+ the
 * `counsellors` row for clinical members). All reads/writes run through `runForOrg`
 * so RLS scopes `org_members`/`counsellors`/`clients`/`appointments` to the org; the
 * Better-Auth `user` table has no RLS, so name/email joins resolve. A role change is
 * the capability boundary — it never grants retroactive note access (roles.ts).
 */
function rid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

const HELD: AppointmentState[] = ["completed", "no_show", "risk_flagged", "discharged"];

function toMember(r: { userId: string; name: string | null; email: string | null; role: string; isSupervisor: boolean; status: string; createdAt: Date; credBody: string | null; credStatus: string | null; caseload?: number; cid?: string | null }): TeamMemberView {
  return {
    userId: r.userId,
    name: r.name ?? "",
    email: r.email ?? "",
    teamRole: r.role as TeamRole,
    isSupervisor: r.isSupervisor,
    status: r.status as MemberStatus,
    active: r.status === "active",
    credential: r.credBody ? { body: r.credBody as CredentialBody, status: r.credStatus as CredentialStatus } : null,
    joinedAt: r.createdAt.toISOString(),
    caseload: r.caseload,
    counsellorId: r.cid ?? null,
  };
}

/** Every member of the org, with role, status, credential, and (counsellors) caseload. */
export async function listTeamDb(orgId: string): Promise<TeamMemberView[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [rows, clientRows] = await Promise.all([
      db.select({
        userId: orgMembers.userId, role: orgMembers.teamRole, isSupervisor: orgMembers.isSupervisor,
        status: orgMembers.status, createdAt: orgMembers.createdAt, name: user.name, email: user.email,
        cid: counsellors.id, credBody: counsellors.credentialBody, credStatus: counsellors.credentialStatus,
      })
        .from(orgMembers)
        .innerJoin(user, eq(orgMembers.userId, user.id))
        .leftJoin(counsellors, and(eq(counsellors.userId, orgMembers.userId), eq(counsellors.orgId, orgId)))
        .where(eq(orgMembers.orgId, orgId)),
      db.select({ c: clients.primaryCounsellorId }).from(clients).where(and(eq(clients.orgId, orgId), isNull(clients.deletedAt))),
    ]);
    const caseloadOf = (cid: string) => clientRows.filter((r) => r.c === cid).length;
    return rows
      .map((r) => toMember({ ...r, caseload: r.cid ? caseloadOf(r.cid) : undefined }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Update a member's role, supervisor flag, and (counsellors) their clinical supervisor. */
export async function saveTeamMemberDb(
  orgId: string,
  input: { userId: string; teamRole: TeamRole; isSupervisor: boolean; supervisorCounsellorId?: string | null; counsellorId?: string | null },
): Promise<{ ok: boolean }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const res = await db.update(orgMembers)
      .set({ teamRole: input.teamRole, isSupervisor: input.isSupervisor })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, input.userId)))
      .returning({ id: orgMembers.id });
    // Mirror onto the counsellor row: the supervisor flag + who they report to.
    if (input.counsellorId) {
      await db.update(counsellors)
        .set({ isSupervisor: input.isSupervisor, ...(input.supervisorCounsellorId !== undefined ? { supervisorId: input.supervisorCounsellorId } : {}) })
        .where(and(eq(counsellors.orgId, orgId), eq(counsellors.id, input.counsellorId)));
    }
    return { ok: res.length > 0 };
  });
}

/** Archive (revoke access) or restore a member. */
export async function setMemberStatusDb(orgId: string, userId: string, status: MemberStatus): Promise<{ ok: boolean }> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(orgMembers).set({ status })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .returning({ id: orgMembers.id });
    return { ok: res.length > 0 };
  });
}

/**
 * Invite a new member: provision (or reuse) a user by email and add an `invited`
 * membership. A counsellor also gets a `counsellors` row (unverified credential) so
 * they can hold a caseload once active. The password is set via the setup link.
 */
export async function inviteMemberDb(
  orgId: string,
  input: { name: string; email: string; teamRole: TeamRole },
  now: string,
): Promise<{ userId: string; existing: boolean }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    // user is not RLS-scoped, so this read/insert works under phila_app.
    const [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email)).limit(1);
    const userId = found?.id ?? rid("user");
    if (!found) {
      await db.insert(user).values({ id: userId, name: input.name, email: input.email, emailVerified: false, platformRole: null, createdAt: new Date(now), updatedAt: new Date(now) });
    }
    await db.insert(orgMembers).values({ orgId, userId, teamRole: input.teamRole, isSupervisor: false, status: "invited", createdAt: new Date(now) }).onConflictDoNothing();
    if (input.teamRole === "counsellor") {
      await db.insert(counsellors).values({ id: rid("couns"), userId, orgId, name: input.name, credentialBody: "HPCSA", credentialStatus: "unverified", isSupervisor: false }).onConflictDoNothing();
    }
    return { userId, existing: Boolean(found) };
  });
}

/** Full detail for one member: role/credential + (counsellors) caseload, schedule, upcoming, stats. */
export async function getTeamMemberDetailDb(orgId: string, userId: string, now: string): Promise<TeamMemberDetail | null> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [m] = await db.select({
      userId: orgMembers.userId, role: orgMembers.teamRole, isSupervisor: orgMembers.isSupervisor,
      status: orgMembers.status, createdAt: orgMembers.createdAt, name: user.name, email: user.email,
    })
      .from(orgMembers).innerJoin(user, eq(orgMembers.userId, user.id))
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId))).limit(1);
    if (!m) return null;

    const [couns] = await db.select().from(counsellors).where(and(eq(counsellors.orgId, orgId), eq(counsellors.userId, userId))).limit(1);
    const member = toMember({ ...m, credBody: couns?.credentialBody ?? null, credStatus: couns?.credentialStatus ?? null, cid: couns?.id ?? null });

    let caseload: TeamMemberDetail["caseload"] = [];
    let upcoming: AppointmentView[] = [];
    let stats: TeamMemberDetail["stats"] = null;
    let roomSchedule: TeamMemberDetail["roomSchedule"] = [];
    let supervisorName: string | null = null;

    if (couns) {
      const nowMs = new Date(now).getTime();
      const [caseRows, apptRows, assignRows, sup] = await Promise.all([
        db.select({ id: clients.id, name: clients.name, riskFlag: clients.riskFlag }).from(clients).where(and(eq(clients.orgId, orgId), eq(clients.primaryCounsellorId, couns.id), isNull(clients.deletedAt))),
        db.select({ a: appointments, clientName: clients.name, serviceName: services.name, roomName: rooms.name })
          .from(appointments)
          .leftJoin(clients, eq(appointments.clientId, clients.id))
          .leftJoin(services, eq(appointments.serviceId, services.id))
          .leftJoin(rooms, eq(appointments.roomId, rooms.id))
          .where(and(eq(appointments.orgId, orgId), eq(appointments.counsellorId, couns.id))),
        db.select({ roomName: rooms.name, days: roomAssignments.days, start: roomAssignments.start, end: roomAssignments.end })
          .from(roomAssignments).leftJoin(rooms, eq(roomAssignments.roomId, rooms.id))
          .where(and(eq(roomAssignments.orgId, orgId), eq(roomAssignments.counsellorId, couns.id))),
        couns.supervisorId ? db.select({ name: counsellors.name }).from(counsellors).where(eq(counsellors.id, couns.supervisorId)).limit(1) : Promise.resolve([]),
      ]);
      caseload = caseRows.map((c) => ({ id: c.id, name: c.name, riskFlag: c.riskFlag }));
      const views: AppointmentView[] = apptRows.map((r) => ({
        id: r.a.id, orgId: r.a.orgId, clientId: r.a.clientId, counsellorId: r.a.counsellorId, serviceId: r.a.serviceId,
        type: r.a.type as AppointmentType, roomId: r.a.roomId, startsAt: r.a.startsAt.toISOString(), durationMin: r.a.durationMin,
        state: r.a.state as AppointmentState, seriesId: r.a.seriesId, tags: (r.a.tags ?? []) as string[],
        clientName: r.clientName ?? "", serviceName: r.serviceName ?? "Session", counsellorName: member.name, roomName: r.roomName ?? null,
      }));
      upcoming = views.filter((v) => new Date(v.startsAt).getTime() > nowMs && v.state === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 8);
      const weekAgo = nowMs - 7 * 86_400_000;
      const week = views.filter((v) => new Date(v.startsAt).getTime() >= weekAgo && new Date(v.startsAt).getTime() <= nowMs);
      stats = { caseload: caseRows.length, sessionsWeek: week.length, seenWeek: week.filter((v) => HELD.includes(v.state)).length };
      roomSchedule = assignRows.map((a) => ({ roomName: a.roomName ?? "", days: a.days, start: a.start, end: a.end }));
      supervisorName = (sup as { name: string }[])[0]?.name ?? null;
    }

    return {
      member,
      profile: null,
      registrationNo: couns?.credentialRegNo ?? null,
      counsellorId: couns?.id ?? null,
      supervisorId: couns?.supervisorId ?? null,
      supervisorName,
      roomSchedule,
      caseload,
      upcoming,
      stats,
    };
  });
}
