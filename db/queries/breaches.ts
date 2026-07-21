import "server-only";
import { and, desc, eq, gte, lte, like } from "drizzle-orm";
import { getDb } from "@/db/client";
import { breachLog, auditLog, clients, orgs } from "@/db/schema";

/**
 * Phase 31.3 — the POPIA s22 breach log. Platform-first: the super-admin records
 * and manages incidents; "who was affected" is derived from the audit trail in
 * the incident window (assembly over new capture).
 */

export interface BreachView {
  id: string;
  orgId: string | null;
  orgName: string | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  occurredAt: string;
  discoveredAt: string;
  containment: string | null;
  createdAt: string;
}

export async function listBreachesDb(): Promise<BreachView[]> {
  const rows = await getDb()
    .select({ b: breachLog, orgName: orgs.name })
    .from(breachLog)
    .leftJoin(orgs, eq(breachLog.orgId, orgs.id))
    .orderBy(desc(breachLog.createdAt));
  return rows.map(({ b, orgName }) => ({
    id: b.id, orgId: b.orgId, orgName, title: b.title, description: b.description,
    severity: b.severity, status: b.status, occurredAt: b.occurredAt.toISOString(),
    discoveredAt: b.discoveredAt.toISOString(), containment: b.containment, createdAt: b.createdAt.toISOString(),
  }));
}

export async function createBreachDb(input: {
  orgId: string | null; title: string; description: string; severity: string;
  occurredAt: string; discoveredAt: string; containment: string | null; createdBy: string;
}): Promise<void> {
  await getDb().insert(breachLog).values({
    orgId: input.orgId, title: input.title, description: input.description, severity: input.severity,
    occurredAt: new Date(input.occurredAt), discoveredAt: new Date(input.discoveredAt),
    containment: input.containment, createdBy: input.createdBy, createdAt: new Date(), updatedAt: new Date(),
  });
}

export async function setBreachStatusDb(id: string, status: string, containment?: string | null): Promise<void> {
  await getDb().update(breachLog)
    .set({ status, ...(containment !== undefined ? { containment } : {}), updatedAt: new Date() })
    .where(eq(breachLog.id, id));
}

/**
 * "Who was affected" — data subjects whose records were touched inside the
 * incident window (from the audit trail), for the s22 notification list.
 * Scoped to the incident's org when set.
 */
export async function affectedSubjectsDb(breachId: string): Promise<{ clientId: string; name: string; phone: string | null; email: string | null }[]> {
  const db = getDb();
  const [b] = await db.select().from(breachLog).where(eq(breachLog.id, breachId)).limit(1);
  if (!b) return [];
  const window = and(
    gte(auditLog.at, b.occurredAt),
    lte(auditLog.at, b.updatedAt),
    like(auditLog.target, "client:%"),
    ...(b.orgId ? [eq(auditLog.orgId, b.orgId)] : []),
  );
  const rows = await db.select({ target: auditLog.target }).from(auditLog).where(window).limit(5000);
  const ids = [...new Set(rows.map((r) => r.target.replace(/^client:/, "").split("/")[0]!))];
  if (ids.length === 0) return [];
  const found = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, email: clients.email }).from(clients);
  return found.filter((c) => ids.includes(c.id)).map((c) => ({ clientId: c.id, name: c.name, phone: c.phone, email: c.email }));
}

/** Org-scoped view for the POPIA pack — an org honestly sees its own incidents. */
export async function orgBreachesDb(orgId: string): Promise<BreachView[]> {
  const rows = await getDb().select().from(breachLog).where(eq(breachLog.orgId, orgId)).orderBy(desc(breachLog.createdAt));
  return rows.map((b) => ({
    id: b.id, orgId: b.orgId, orgName: null, title: b.title, description: b.description,
    severity: b.severity, status: b.status, occurredAt: b.occurredAt.toISOString(),
    discoveredAt: b.discoveredAt.toISOString(), containment: b.containment, createdAt: b.createdAt.toISOString(),
  }));
}
