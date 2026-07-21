import "server-only";
import { and, desc, eq, like, max } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  clients, appointments, sessionNotes, carePlans, consents, demographics,
  outcomeMeasures, clientDocuments, invoices, auditLog, counsellors, services, orgs,
} from "@/db/schema";
import { retentionClock, erasureDecision, retentionLabel, type RetentionClock } from "@/lib/compliance/retention";

/**
 * Phase 31.1 — data-subject request (DSAR) tooling. Assembly over new capture:
 * everything already exists in the org's tables; these queries gather it into one
 * portable object (export) or run the lawful de-identification path (erasure).
 * Callers guard with requireHub + their own org, and audit fail-strict.
 */

export interface DsarExport {
  generatedAt: string;
  organisation: { id: string; name: string };
  client: Record<string, unknown>;
  appointments: Record<string, unknown>[];
  /** Clinical-note METADATA only — note bodies stay under the clinical record
   *  (requestable via the practice under the HPCSA access process). */
  clinicalNotes: Record<string, unknown>[];
  carePlan: Record<string, unknown> | null;
  consents: Record<string, unknown>[];
  demographics: Record<string, unknown> | null;
  outcomes: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  /** Who accessed this person's record, when, and why (their POPIA right to know). */
  accessAudit: Record<string, unknown>[];
  retention: { label: string; rule: string; retainUntil: string | null; legalHold: boolean };
}

/** The client's retention clock from facts we hold (last session/note + DOB). */
export async function clientRetentionDb(orgId: string, clientId: string, nowISO: string): Promise<{ clock: RetentionClock; label: string; legalHold: boolean; legalHoldReason: string | null; lastEntryAt: string } | null> {
  const db = getDb();
  const [c] = await db.select({ profile: clients.profile, legalHold: clients.legalHold, legalHoldReason: clients.legalHoldReason, createdAt: clients.createdAt })
    .from(clients).where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))).limit(1);
  if (!c) return null;
  const [last] = await db.select({ last: max(appointments.startsAt) }).from(appointments)
    .where(and(eq(appointments.orgId, orgId), eq(appointments.clientId, clientId)));
  const lastEntryAt = (last?.last ?? c.createdAt).toISOString();
  const dob = (c.profile as Record<string, string> | null)?.dateOfBirth || null;
  const clock = retentionClock({ lastEntryAt, dateOfBirth: dob });
  return { clock, label: retentionLabel(clock, nowISO), legalHold: c.legalHold, legalHoldReason: c.legalHoldReason, lastEntryAt };
}

/** "Everything we hold on this person" — one portable, machine-readable object. */
export async function exportDataSubjectDb(orgId: string, clientId: string, nowISO: string): Promise<DsarExport | null> {
  const db = getDb();
  const [client] = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))).limit(1);
  if (!client) return null;
  const [org] = await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);

  const appts = await db
    .select({ a: appointments, counsellorName: counsellors.name, serviceName: services.name })
    .from(appointments)
    .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.clientId, clientId)))
    .orderBy(desc(appointments.startsAt));

  const apptIds = appts.map((r) => r.a.id);
  const notesMeta = apptIds.length
    ? (await db.select({ appointmentId: sessionNotes.appointmentId, signedAt: sessionNotes.signedAt })
        .from(sessionNotes)).filter((n) => apptIds.includes(n.appointmentId))
    : [];

  const [plan] = await db.select().from(carePlans).where(eq(carePlans.clientId, clientId)).limit(1);
  const consentRows = await db.select().from(consents).where(eq(consents.clientId, clientId));
  const [demo] = await db.select().from(demographics).where(eq(demographics.clientId, clientId)).limit(1);
  const outcomes = await db.select().from(outcomeMeasures).where(eq(outcomeMeasures.clientId, clientId));
  const docs = await db.select({ id: clientDocuments.id, name: clientDocuments.name, sizeLabel: clientDocuments.sizeLabel, uploadedAt: clientDocuments.createdAt })
    .from(clientDocuments).where(eq(clientDocuments.clientId, clientId));
  const invs = await db.select({ id: invoices.id, number: invoices.number, amountCents: invoices.amountCents, status: invoices.status, issuedAt: invoices.issuedAt, dueAt: invoices.dueAt })
    .from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.clientId, clientId)));

  const access = await db.select({ action: auditLog.action, actorUserId: auditLog.actorUserId, reason: auditLog.reason, at: auditLog.at })
    .from(auditLog)
    .where(and(eq(auditLog.orgId, orgId), like(auditLog.target, `%${clientId}%`)))
    .orderBy(desc(auditLog.at))
    .limit(500);

  const retention = await clientRetentionDb(orgId, clientId, nowISO);

  return {
    generatedAt: nowISO,
    organisation: { id: org?.id ?? orgId, name: org?.name ?? orgId },
    client: {
      name: client.name, phone: client.phone, email: client.email, province: client.province,
      profile: client.profile, referralSource: client.referralSource, createdAt: client.createdAt.toISOString(),
    },
    appointments: appts.map((r) => ({ id: r.a.id, startsAt: r.a.startsAt.toISOString(), durationMin: r.a.durationMin, state: r.a.state, type: r.a.type, service: r.serviceName, counsellor: r.counsellorName })),
    clinicalNotes: notesMeta.map((n) => ({ appointmentId: n.appointmentId, signedAt: n.signedAt?.toISOString() ?? null, note: "Clinical note content is part of the practice's health record (HPCSA); request access via the practice." })),
    carePlan: plan ? { summary: plan.summary, tasks: plan.tasks, sharedAt: plan.sharedAt?.toISOString() ?? null } : null,
    consents: consentRows.map((c) => ({ purpose: c.purpose, state: c.state, version: c.version, updatedAt: c.updatedAt.toISOString() })),
    demographics: demo ? { gender: demo.gender, populationGroup: demo.populationGroup, employmentStatus: demo.employmentStatus, ageBand: demo.ageBand } : null,
    outcomes: outcomes.map((o) => ({ tool: o.tool, score: o.score, takenAt: o.takenAt.toISOString() })),
    documents: docs.map((d) => ({ name: d.name, size: d.sizeLabel, uploadedAt: d.uploadedAt.toISOString() })),
    invoices: invs.map((i) => ({ number: i.number, amountCents: i.amountCents, status: i.status, issuedAt: i.issuedAt.toISOString(), dueAt: i.dueAt.toISOString() })),
    accessAudit: access.map((a) => ({ action: a.action, actor: a.actorUserId, reason: a.reason, at: a.at.toISOString() })),
    retention: {
      label: retention?.label ?? "Unknown",
      rule: retention?.clock.rule ?? "standard",
      retainUntil: retention?.clock.retainUntil ?? null,
      legalHold: retention?.legalHold ?? false,
    },
  };
}

/**
 * Erasure — POPIA honoured-where-lawful. Whatever the clock says, the reachable
 * PII is de-identified NOW (name → pseudonym, contact/profile cleared) and the
 * record is soft-deleted (drops from caseloads; history preserved for stats —
 * Outcome-Honesty). Where retention still applies the clinical record stays under
 * its clock (the Cluster-3 pruner destroys it when lawful); the honest decision
 * is returned to show the requester.
 */
export async function eraseDataSubjectDb(orgId: string, clientId: string, nowISO: string): Promise<{ ok: boolean; decision: { allowed: boolean; reason: string } } | null> {
  const db = getDb();
  const retention = await clientRetentionDb(orgId, clientId, nowISO);
  if (!retention) return null;
  const decision = erasureDecision(retention.clock, nowISO, retention.legalHold);
  if (retention.legalHold) return { ok: false, decision };

  const pseudonym = `Removed client ${clientId.slice(-4).toUpperCase()}`;
  await db.update(clients).set({
    name: pseudonym,
    phone: null,
    email: null,
    referralSource: null,
    profile: {},
    deletedAt: new Date(nowISO),
  }).where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)));

  // Special-category demographics are removed outright — never needed for the clinical record.
  await db.delete(demographics).where(eq(demographics.clientId, clientId));

  return { ok: true, decision };
}

/** Legal hold on/off (blocks pruning + erasure while set). */
export async function setLegalHoldDb(orgId: string, clientId: string, on: boolean, reason: string | null): Promise<void> {
  await getDb().update(clients).set({ legalHold: on, legalHoldReason: on ? reason : null })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)));
}
