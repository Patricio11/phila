import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { appointments, clients } from "@/db/schema";
import { isSlotTakenError } from "@/db/queries/errors";
import type { Province } from "@/lib/domain/enums";
import type { FeePolicy } from "@/lib/billing/fees";

/**
 * Client writes (Phase 10/11)  real, org-scoped persistence for the hub caseload.
 * Every write is scoped by `orgId` (the tenant boundary) as well as the row id, so a
 * hub admin can only ever touch their own org's clients. Removal is a **soft delete**
 * (`deletedAt`)  the record + full history are retained (Outcome-Honesty Rule), and
 * a restore just clears the timestamp.
 *
 * Each write runs via `runForOrg`, so it executes as the non-owner `phila_app` role
 * with `app.org_id` set: the RLS WITH CHECK / USING clauses reject any cross-org
 * insert or update at the database, beneath the app-layer `where org_id` filters.
 */
function rid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

const clean = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

export interface ClientWriteInput {
  name: string;
  phone?: string;
  email?: string;
  province: Province;
  counsellorId: string;
  riskFlag: boolean;
  /** How the client found the practice (W7); undefined = leave unchanged/unset. */
  referralSource?: string | null;
}

/** Insert a new client onto the org's caseload. Returns the new id. */
export async function createClientDb(orgId: string, input: ClientWriteInput, now: string): Promise<{ id: string }> {
  const id = rid("cl");
  await runForOrg(orgId, () => activeDb().insert(clients).values({
    id,
    orgId,
    name: input.name.trim(),
    phone: clean(input.phone),
    email: clean(input.email),
    province: input.province,
    primaryCounsellorId: input.counsellorId,
    riskFlag: input.riskFlag,
    referralSource: input.referralSource ?? null,
    createdAt: new Date(now),
  }));
  return { id };
}

export interface ImportRow { name: string; phone: string | null; email: string | null; province: string }

/** Bulk-insert imported clients (unassigned  no primary counsellor). Returns the count. */
export async function createClientsDb(orgId: string, rows: ImportRow[], now: string): Promise<number> {
  if (rows.length === 0) return 0;
  const createdAt = new Date(now);
  const values = rows.map((r) => ({
    id: rid("cl"),
    orgId,
    name: r.name.trim(),
    phone: clean(r.phone),
    email: clean(r.email),
    province: r.province,
    primaryCounsellorId: null,
    riskFlag: false,
    createdAt,
  }));
  // Insert in chunks so a very large import doesn't blow the parameter limit.
  const CHUNK = 500;
  await runForOrg(orgId, async () => {
    const db = activeDb();
    for (let i = 0; i < values.length; i += CHUNK) {
      await db.insert(clients).values(values.slice(i, i + CHUNK));
    }
  });
  return values.length;
}

/** Update every editable field on a client, scoped to the org. */
export async function updateClientDb(orgId: string, clientId: string, input: ClientWriteInput): Promise<void> {
  await runForOrg(orgId, () => activeDb()
    .update(clients)
    .set({
      name: input.name.trim(),
      phone: clean(input.phone),
      email: clean(input.email),
      province: input.province,
      primaryCounsellorId: input.counsellorId,
      riskFlag: input.riskFlag,
      ...(input.referralSource !== undefined ? { referralSource: input.referralSource } : {}),
    })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))));
}

/** Set (or clear, with null) a client's sliding-scale fee policy (W7). RLS-scoped. */
export async function setClientFeeDb(orgId: string, clientId: string, policy: FeePolicy | null): Promise<void> {
  await runForOrg(orgId, () => activeDb()
    .update(clients)
    .set({ feePolicy: policy })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))));
}

/** A client's current fee policy (null = standard/list price). RLS-scoped. */
export async function getClientFeeDb(orgId: string, clientId: string): Promise<FeePolicy | null> {
  const [row] = await runForOrg(orgId, () => activeDb().select({ f: clients.feePolicy }).from(clients).where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))).limit(1));
  return (row?.f as FeePolicy | null) ?? null;
}

/** A client's referral source (how they found the practice; null = not captured). RLS-scoped. */
export async function getClientReferralDb(orgId: string, clientId: string): Promise<string | null> {
  const [row] = await runForOrg(orgId, () => activeDb().select({ r: clients.referralSource }).from(clients).where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))).limit(1));
  return row?.r ?? null;
}

/** Soft-delete (removed=true) or restore (removed=false) a client. */
export async function setClientRemovedDb(orgId: string, clientId: string, removed: boolean, now: string): Promise<void> {
  await runForOrg(orgId, () => activeDb()
    .update(clients)
    .set({ deletedAt: removed ? new Date(now) : null })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))));
}

/**
 * Move a set of FUTURE scheduled sessions to another counsellor, one row at a time
 * so a diary clash (the GiST no-double-booking constraint) skips just that session
 * instead of failing the whole transfer. Past sessions are never touched  the
 * clinical history (notes, outcomes, attendance) stays exactly as it happened.
 */
async function moveFutureSessions(orgId: string, where: { clientId?: string; fromCounsellorId: string }, toCounsellorId: string): Promise<{ moved: number; skipped: number }> {
  const rows = await runForOrg(orgId, () => activeDb()
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(
      eq(appointments.orgId, orgId),
      eq(appointments.counsellorId, where.fromCounsellorId),
      ...(where.clientId ? [eq(appointments.clientId, where.clientId)] : []),
      eq(appointments.state, "scheduled"),
      gt(appointments.startsAt, new Date()),
    )));
  let moved = 0;
  let skipped = 0;
  for (const r of rows) {
    try {
      await runForOrg(orgId, () => activeDb()
        .update(appointments)
        .set({ counsellorId: toCounsellorId })
        .where(and(eq(appointments.id, r.id), eq(appointments.orgId, orgId))));
      moved++;
    } catch (e) {
      if (isSlotTakenError(e)) { skipped++; continue; } // new counsellor busy at that time
      throw e;
    }
  }
  return { moved, skipped };
}

/** Move a client to another primary counsellor. Their FUTURE scheduled sessions move
 * too; the full history (past sessions, notes, outcomes) stays intact. */
export async function reassignClientDb(orgId: string, clientId: string, counsellorId: string): Promise<{ moved: number; skipped: number }> {
  const [row] = await runForOrg(orgId, () => activeDb()
    .select({ prev: clients.primaryCounsellorId })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)))
    .limit(1));
  await runForOrg(orgId, () => activeDb()
    .update(clients)
    .set({ primaryCounsellorId: counsellorId })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId))));
  if (!row?.prev || row.prev === counsellorId) return { moved: 0, skipped: 0 };
  return moveFutureSessions(orgId, { clientId, fromCounsellorId: row.prev }, counsellorId);
}

/**
 * Transfer a counsellor's WHOLE caseload to another counsellor (Phase 18.8)  for
 * an intern leaving or a terminated contract. Re-points every active client's
 * primary counsellor and moves all future scheduled sessions; everything that
 * already happened (sessions, notes, outcomes, documents) remains untouched.
 */
export async function transferCaseloadDb(orgId: string, fromCounsellorId: string, toCounsellorId: string): Promise<{ clients: number; moved: number; skipped: number }> {
  const reassigned = await runForOrg(orgId, () => activeDb()
    .update(clients)
    .set({ primaryCounsellorId: toCounsellorId })
    .where(and(eq(clients.orgId, orgId), eq(clients.primaryCounsellorId, fromCounsellorId), isNull(clients.deletedAt)))
    .returning({ id: clients.id }));
  const sessions = await moveFutureSessions(orgId, { fromCounsellorId }, toCounsellorId);
  return { clients: reassigned.length, ...sessions };
}
