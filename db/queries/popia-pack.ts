import "server-only";
import { and, desc, eq, gte, max, sql as dsql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgs, clients, appointments, consents, auditLog } from "@/db/schema";
import { retentionClock, retentionExpired } from "@/lib/compliance/retention";
import { orgBreachesDb, type BreachView } from "@/db/queries/breaches";

/**
 * Phase 31.4 — the one-click POPIA pack. Pure assembly: consent evidence,
 * the access-audit trail, retention posture, breach entries, and (rendered by
 * the page) the platform sub-processor register. Nothing here is newly captured.
 */

export interface PopiaPack {
  generatedAt: string;
  org: { id: string; name: string; province: string };
  consents: { purpose: string; granted: number; revoked: number }[];
  consentTotal: number;
  audit: { last12mo: { action: string; count: number }[]; recent: { action: string; actor: string | null; target: string; reason: string | null; at: string }[]; total12mo: number };
  retention: { clients: number; standard: number; minor: number; lapsed: number; legalHolds: number; erased: number };
  breaches: BreachView[];
}

export async function assemblePopiaPackDb(orgId: string, nowISO: string): Promise<PopiaPack | null> {
  const db = getDb();
  const [org] = await db.select({ id: orgs.id, name: orgs.name, province: orgs.province }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) return null;

  // Consent evidence — counts per purpose by state (the raw rows stay queryable in-app).
  const consentRows = await db.select({ purpose: consents.purpose, state: consents.state, n: dsql<number>`count(*)::int` })
    .from(consents).where(eq(consents.orgId, orgId)).groupBy(consents.purpose, consents.state);
  const byPurpose = new Map<string, { granted: number; revoked: number }>();
  let consentTotal = 0;
  for (const r of consentRows) {
    const e = byPurpose.get(r.purpose) ?? { granted: 0, revoked: 0 };
    if (r.state === "granted") e.granted += r.n;
    if (r.state === "revoked") e.revoked += r.n;
    consentTotal += r.n;
    byPurpose.set(r.purpose, e);
  }

  // Access audit — 12-month shape + the most recent trail.
  const yearAgo = new Date(new Date(nowISO).getTime() - 365 * 86_400_000);
  const grouped = await db.select({ action: auditLog.action, n: dsql<number>`count(*)::int` })
    .from(auditLog).where(and(eq(auditLog.orgId, orgId), gte(auditLog.at, yearAgo))).groupBy(auditLog.action);
  const recent = await db.select({ action: auditLog.action, actor: auditLog.actorUserId, target: auditLog.target, reason: auditLog.reason, at: auditLog.at })
    .from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(desc(auditLog.at)).limit(40);

  // Retention posture — computed clocks across the org's clients.
  const cls = await db.select({ id: clients.id, profile: clients.profile, legalHold: clients.legalHold, deletedAt: clients.deletedAt, createdAt: clients.createdAt })
    .from(clients).where(eq(clients.orgId, orgId));
  const lasts = await db.select({ clientId: appointments.clientId, last: max(appointments.startsAt) })
    .from(appointments).where(eq(appointments.orgId, orgId)).groupBy(appointments.clientId);
  const lastBy = new Map(lasts.map((l) => [l.clientId, l.last]));
  let standard = 0, minor = 0, lapsed = 0, holds = 0, erased = 0;
  for (const c of cls) {
    const clock = retentionClock({
      lastEntryAt: (lastBy.get(c.id) ?? c.createdAt).toISOString(),
      dateOfBirth: (c.profile as Record<string, string> | null)?.dateOfBirth || null,
    });
    if (clock.rule === "minor") minor++; else standard++;
    if (retentionExpired(clock, nowISO)) lapsed++;
    if (c.legalHold) holds++;
    if (c.deletedAt) erased++;
  }

  return {
    generatedAt: nowISO,
    org,
    consents: [...byPurpose.entries()].map(([purpose, v]) => ({ purpose, ...v })).sort((a, b) => a.purpose.localeCompare(b.purpose)),
    consentTotal,
    audit: {
      last12mo: grouped.map((g) => ({ action: g.action, count: g.n })).sort((a, b) => b.count - a.count),
      recent: recent.map((r) => ({ action: r.action, actor: r.actor, target: r.target, reason: r.reason, at: r.at.toISOString() })),
      total12mo: grouped.reduce((s, g) => s + g.n, 0),
    },
    retention: { clients: cls.length, standard, minor, lapsed, legalHolds: holds, erased },
    breaches: await orgBreachesDb(orgId),
  };
}
