import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { runForOrg, activeDb } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { waitlistEntries, clients, counsellors } from "@/db/schema";

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
 *  Owner connection — the cancellation hook already trusts orgId. Marks them offered. */
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
