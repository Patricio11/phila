import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { runForOrg, activeDb } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { waitlistEntries, clients, counsellors, companies, formAssignments } from "@/db/schema";

/**
 * Waitlist (W7). Clients waiting for a slot; when a session is cancelled the matching
 * entries are offered the freed slot via the messaging rail. RLS-scoped for the org
 * surface; the cancellation hook reads via the owner connection (it already has orgId).
 */
export interface WaitlistItem {
  id: string;
  clientId: string;
  clientName: string;
  counsellorId: string | null;
  counsellorName: string | null;
  serviceId: string | null;
  note: string | null;
  createdAt: string;
  offeredAt: string | null;
}

export async function addWaitlistDb(orgId: string, input: { clientId: string; counsellorId: string | null; serviceId: string | null; note: string | null }): Promise<{ id: string }> {
  const id = `wl_${randomUUID()}`;
  await runForOrg(orgId, () => activeDb().insert(waitlistEntries).values({
    id, orgId, clientId: input.clientId, counsellorId: input.counsellorId, serviceId: input.serviceId,
    note: input.note, status: "waiting", createdAt: new Date(),
  }));
  return { id };
}

/** The org's active waitlist (oldest first), with client + counsellor names. RLS-scoped. */
export async function listWaitlistDb(orgId: string): Promise<WaitlistItem[]> {
  return runForOrg(orgId, async () => {
    const rows = await activeDb().select({
      id: waitlistEntries.id, clientId: waitlistEntries.clientId, clientName: clients.name,
      counsellorId: waitlistEntries.counsellorId, counsellorName: counsellors.name,
      serviceId: waitlistEntries.serviceId, note: waitlistEntries.note, createdAt: waitlistEntries.createdAt, offeredAt: waitlistEntries.offeredAt,
    })
      .from(waitlistEntries)
      .leftJoin(clients, eq(clients.id, waitlistEntries.clientId))
      .leftJoin(counsellors, eq(counsellors.id, waitlistEntries.counsellorId))
      .where(and(eq(waitlistEntries.orgId, orgId), eq(waitlistEntries.status, "waiting")))
      .orderBy(asc(waitlistEntries.createdAt));
    return rows.map((r) => ({
      id: r.id, clientId: r.clientId, clientName: r.clientName ?? "A client",
      counsellorId: r.counsellorId, counsellorName: r.counsellorName ?? null,
      serviceId: r.serviceId, note: r.note, createdAt: r.createdAt.toISOString(), offeredAt: r.offeredAt?.toISOString() ?? null,
    }));
  });
}

export async function removeWaitlistDb(orgId: string, id: string): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(waitlistEntries).set({ status: "removed" }).where(and(eq(waitlistEntries.id, id), eq(waitlistEntries.orgId, orgId))));
}

export async function placeWaitlistDb(orgId: string, id: string): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(waitlistEntries).set({ status: "placed", placedAt: new Date() }).where(and(eq(waitlistEntries.id, id), eq(waitlistEntries.orgId, orgId))));
}

/** Whether a client is already waiting (to avoid duplicates). RLS-scoped. */
export async function isClientWaitingDb(orgId: string, clientId: string): Promise<boolean> {
  const rows = await runForOrg(orgId, () => activeDb().select({ id: waitlistEntries.id }).from(waitlistEntries).where(and(eq(waitlistEntries.orgId, orgId), eq(waitlistEntries.clientId, clientId), eq(waitlistEntries.status, "waiting"))).limit(1));
  return rows.length > 0;
}

/** Matching waiting entries for a freed slot (same counsellor, or counsellor-agnostic).
 *  Owner connection - the cancellation hook already trusts orgId. Marks them offered. */
export async function offerFreedSlotDb(orgId: string, counsellorId: string): Promise<{ id: string; clientId: string }[]> {
  const db = getDb();
  const rows = await db.select({ id: waitlistEntries.id, clientId: waitlistEntries.clientId })
    .from(waitlistEntries)
    .where(and(
      eq(waitlistEntries.orgId, orgId),
      eq(waitlistEntries.status, "waiting"),
      or(isNull(waitlistEntries.counsellorId), eq(waitlistEntries.counsellorId, counsellorId)),
    ))
    .orderBy(asc(waitlistEntries.createdAt));
  if (rows.length) {
    const now = new Date();
    for (const r of rows) await db.update(waitlistEntries).set({ offeredAt: now }).where(eq(waitlistEntries.id, r.id));
  }
  return rows;
}

/* ── Batch 2t - the waitlist as a page, not just a card ──────────────────── */

export interface WaitlistDetail extends WaitlistItem {
  companyId: string | null;
  companyName: string | null;
  /** The intake they completed, so the practice can read it before booking. */
  formTitle: string | null;
  formToken: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
}

/**
 * Everyone waiting, with the employer paying (if any) and the intake they
 * completed. One query: the page shows who, from where, how long, and why.
 */
export async function listWaitlistDetailedDb(orgId: string): Promise<WaitlistDetail[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const rows = await db.select({
      id: waitlistEntries.id, clientId: waitlistEntries.clientId, clientName: clients.name,
      clientEmail: clients.email, clientPhone: clients.phone, companyId: clients.companyId,
      counsellorId: waitlistEntries.counsellorId, counsellorName: counsellors.name,
      serviceId: waitlistEntries.serviceId, note: waitlistEntries.note,
      createdAt: waitlistEntries.createdAt, offeredAt: waitlistEntries.offeredAt,
    })
      .from(waitlistEntries)
      .leftJoin(clients, eq(clients.id, waitlistEntries.clientId))
      .leftJoin(counsellors, eq(counsellors.id, waitlistEntries.counsellorId))
      .where(and(eq(waitlistEntries.orgId, orgId), eq(waitlistEntries.status, "waiting")))
      .orderBy(asc(waitlistEntries.createdAt));
    if (rows.length === 0) return [];

    const clientIds = rows.map((r) => r.clientId);
    const [companyRows, responses] = await Promise.all([
      db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.orgId, orgId)),
      db.select({ clientId: formAssignments.clientId, token: formAssignments.token, snapshot: formAssignments.snapshot, submittedAt: formAssignments.submittedAt })
        .from(formAssignments)
        .where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.status, "completed"), inArray(formAssignments.clientId, clientIds))),
    ]);
    const companyName = new Map(companyRows.map((c) => [c.id, c.name]));
    // The most recent completed response per person is the one worth reading.
    const latest = new Map<string, { token: string; title: string; at: number }>();
    for (const r of responses) {
      if (!r.clientId) continue;
      const title = ((r.snapshot as { title?: string } | null)?.title) ?? "Intake form";
      const at = r.submittedAt?.getTime() ?? 0;
      const cur = latest.get(r.clientId);
      if (!cur || at > cur.at) latest.set(r.clientId, { token: r.token, title, at });
    }

    return rows.map((r): WaitlistDetail => ({
      id: r.id, clientId: r.clientId, clientName: r.clientName ?? "A client",
      counsellorId: r.counsellorId, counsellorName: r.counsellorName ?? null,
      serviceId: r.serviceId, note: r.note,
      createdAt: r.createdAt.toISOString(), offeredAt: r.offeredAt?.toISOString() ?? null,
      companyId: r.companyId ?? null,
      companyName: r.companyId ? (companyName.get(r.companyId) ?? null) : null,
      formTitle: latest.get(r.clientId)?.title ?? null,
      formToken: latest.get(r.clientId)?.token ?? null,
      clientEmail: r.clientEmail ?? null,
      clientPhone: r.clientPhone ?? null,
    }));
  });
}
