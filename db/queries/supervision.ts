import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { sessionNotes, appointments, counsellors, clients, services } from "@/db/schema";
import type { SupervisionItem, SupervisionOverview } from "@/lib/data-provider";
import type { CredentialBody, CredentialStatus } from "@/lib/domain/enums";

/**
 * Supervision (W1.1). A supervisor reviews their supervisees' signed notes and signs
 * them off (or requests changes). All reads/writes run inside `runForOrg`, so RLS
 * scopes `session_notes` (via appointments.org_id) + the counsellor/client tables to
 * the org. Authorisation is by the counsellor→supervisor link (`counsellors.supervisor_id`).
 */
const excerpt = (body: string) => (body.length > 180 ? `${body.slice(0, 180).trimEnd()}…` : body);

/** The supervisor's queue: supervisees' notes that are signed but not yet signed off. */
export async function getSupervisionQueueDb(orgId: string, supervisorId: string): Promise<SupervisionItem[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const supervisees = await db.select({ id: counsellors.id, name: counsellors.name }).from(counsellors)
      .where(and(eq(counsellors.orgId, orgId), eq(counsellors.supervisorId, supervisorId)));
    const ids = supervisees.map((s) => s.id);
    if (!ids.length) return [];
    const nameById = new Map(supervisees.map((s) => [s.id, s.name]));
    const rows = await db
      .select({ note: sessionNotes, appt: appointments, clientName: clients.name, serviceName: services.name })
      .from(sessionNotes)
      .innerJoin(appointments, eq(sessionNotes.appointmentId, appointments.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(and(inArray(sessionNotes.authorCounsellorId, ids), isNotNull(sessionNotes.signedAt), isNull(sessionNotes.supervisorSignedAt)));
    return rows
      .map((r): SupervisionItem => ({
        id: r.note.id,
        superviseeId: r.note.authorCounsellorId,
        superviseeName: nameById.get(r.note.authorCounsellorId) ?? "",
        clientName: r.clientName ?? "Client",
        serviceName: r.serviceName ?? "Session",
        sessionAt: r.appt.startsAt.toISOString(),
        submittedAt: r.note.signedAt!.toISOString(),
        noteExcerpt: excerpt(r.note.body),
        aiGenerated: r.note.aiGenerated,
        riskFlagged: r.appt.state === "risk_flagged",
      }))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  });
}

export async function getSupervisionOverviewDb(orgId: string, supervisorId: string, now: string): Promise<SupervisionOverview> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const supervisees = await db.select().from(counsellors)
      .where(and(eq(counsellors.orgId, orgId), eq(counsellors.supervisorId, supervisorId)));
    const ids = supervisees.map((s) => s.id);
    if (!ids.length) return { supervisees: [], pendingCount: 0, signedThisMonth: 0, avgTurnaroundHours: 0 };

    const [caseRows, noteRows] = await Promise.all([
      db.select({ id: clients.id, c: clients.primaryCounsellorId }).from(clients).where(and(eq(clients.orgId, orgId), isNull(clients.deletedAt))),
      db.select({ author: sessionNotes.authorCounsellorId, signedAt: sessionNotes.signedAt, supBy: sessionNotes.supervisorId, supAt: sessionNotes.supervisorSignedAt })
        .from(sessionNotes)
        .innerJoin(appointments, eq(sessionNotes.appointmentId, appointments.id))
        .where(and(eq(appointments.orgId, orgId), inArray(sessionNotes.authorCounsellorId, ids))),
    ]);

    const caseloadOf = (cid: string) => caseRows.filter((r) => r.c === cid).length;
    const pendingOf = (cid: string) => noteRows.filter((n) => n.author === cid && n.signedAt && !n.supAt).length;
    const summaries = supervisees.map((c) => ({
      id: c.id, name: c.name,
      credential: { body: c.credentialBody as CredentialBody, status: c.credentialStatus as CredentialStatus },
      caseload: caseloadOf(c.id), pending: pendingOf(c.id),
    }));

    const monthStart = new Date(now); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const signedThisMonth = noteRows.filter((n) => n.supBy === supervisorId && n.supAt && n.supAt >= monthStart).length;
    const turnarounds = noteRows.filter((n) => n.supAt && n.signedAt).map((n) => (n.supAt!.getTime() - n.signedAt!.getTime()) / 3_600_000);
    const avgTurnaroundHours = turnarounds.length ? Math.round(turnarounds.reduce((s, h) => s + h, 0) / turnarounds.length) : 0;

    return { supervisees: summaries, pendingCount: summaries.reduce((s, x) => s + x.pending, 0), signedThisMonth, avgTurnaroundHours };
  });
}

/**
 * Record a supervisor's decision on a note. Authorised: the note's author must be a
 * supervisee of `supervisorCounsellorId`. Returns false if not found / not permitted.
 */
export async function signOffNoteDb(
  orgId: string,
  input: { noteId: string; supervisorCounsellorId: string; decision: "approved" | "changes_requested"; comment?: string | null },
  now: string,
): Promise<{ ok: boolean }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const supervisees = await db.select({ id: counsellors.id }).from(counsellors)
      .where(and(eq(counsellors.orgId, orgId), eq(counsellors.supervisorId, input.supervisorCounsellorId)));
    const ids = supervisees.map((s) => s.id);
    if (!ids.length) return { ok: false };
    const res = await db.update(sessionNotes)
      .set({ supervisorId: input.supervisorCounsellorId, supervisorSignedAt: new Date(now), supervisorDecision: input.decision, supervisorComment: input.comment ?? null })
      .where(and(eq(sessionNotes.id, input.noteId), inArray(sessionNotes.authorCounsellorId, ids)))
      .returning({ id: sessionNotes.id });
    return { ok: res.length > 0 };
  });
}
