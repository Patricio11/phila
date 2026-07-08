import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { runForOrg, activeDb } from "@/lib/db/scoped";
import { appointmentChangeRequests, appointments, clients } from "@/db/schema";

/**
 * Client appointment-change requests (W6.2). A client never edits a booking directly —
 * they submit a reason and the practice actions or declines it. The client path uses
 * the owner connection (no org session, like booking/pay), with ownership verified
 * explicitly; the org path is RLS-scoped through `phila_app`.
 */
export type ChangeKind = "reschedule" | "cancel";
export type ChangeStatus = "pending" | "approved" | "declined" | "withdrawn";

export interface PendingChangeRequest {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  counsellorId: string;
  kind: ChangeKind;
  reason: string;
  startsAt: string;
  createdAt: string;
}

/** Create a request (client side, owner connection). Returns null if one is already pending. */
export async function createChangeRequestDb(input: { id: string; orgId: string; appointmentId: string; clientId: string; kind: ChangeKind; reason: string }): Promise<boolean> {
  const db = getDb();
  const existing = await db.select({ id: appointmentChangeRequests.id }).from(appointmentChangeRequests)
    .where(and(eq(appointmentChangeRequests.appointmentId, input.appointmentId), eq(appointmentChangeRequests.status, "pending")))
    .limit(1);
  if (existing.length) return false;
  await db.insert(appointmentChangeRequests).values({
    id: input.id, orgId: input.orgId, appointmentId: input.appointmentId, clientId: input.clientId,
    kind: input.kind, reason: input.reason, status: "pending", createdAt: new Date(),
  });
  return true;
}

/** Which of these appointments already have a pending request (client card state). Owner connection. */
export async function pendingRequestKindsDb(appointmentIds: string[]): Promise<Record<string, ChangeKind>> {
  if (appointmentIds.length === 0) return {};
  const rows = await getDb().select({ appointmentId: appointmentChangeRequests.appointmentId, kind: appointmentChangeRequests.kind })
    .from(appointmentChangeRequests)
    .where(and(inArray(appointmentChangeRequests.appointmentId, appointmentIds), eq(appointmentChangeRequests.status, "pending")));
  return Object.fromEntries(rows.map((r) => [r.appointmentId, r.kind as ChangeKind]));
}

/** The org's pending requests, with the session + client context. RLS-scoped. */
export async function listPendingChangeRequestsDb(orgId: string): Promise<PendingChangeRequest[]> {
  return runForOrg(orgId, async () => {
    const rows = await activeDb().select({
      id: appointmentChangeRequests.id, appointmentId: appointmentChangeRequests.appointmentId,
      clientId: appointmentChangeRequests.clientId, clientName: clients.name, kind: appointmentChangeRequests.kind,
      reason: appointmentChangeRequests.reason, createdAt: appointmentChangeRequests.createdAt,
      startsAt: appointments.startsAt, counsellorId: appointments.counsellorId,
    })
      .from(appointmentChangeRequests)
      .innerJoin(appointments, eq(appointments.id, appointmentChangeRequests.appointmentId))
      .leftJoin(clients, eq(clients.id, appointmentChangeRequests.clientId))
      .where(and(eq(appointmentChangeRequests.orgId, orgId), eq(appointmentChangeRequests.status, "pending")))
      .orderBy(desc(appointmentChangeRequests.createdAt));
    return rows.map((r) => ({
      id: r.id, appointmentId: r.appointmentId, clientId: r.clientId, clientName: r.clientName ?? "A client",
      counsellorId: r.counsellorId, kind: r.kind as ChangeKind, reason: r.reason,
      startsAt: r.startsAt.toISOString(), createdAt: r.createdAt.toISOString(),
    }));
  });
}

/** Fetch one pending request (for resolution), scoped to the org. */
export async function getChangeRequestDb(orgId: string, requestId: string): Promise<{ id: string; appointmentId: string; clientId: string; kind: ChangeKind } | null> {
  return runForOrg(orgId, async () => {
    const [r] = await activeDb().select({ id: appointmentChangeRequests.id, appointmentId: appointmentChangeRequests.appointmentId, clientId: appointmentChangeRequests.clientId, kind: appointmentChangeRequests.kind })
      .from(appointmentChangeRequests)
      .where(and(eq(appointmentChangeRequests.id, requestId), eq(appointmentChangeRequests.orgId, orgId), eq(appointmentChangeRequests.status, "pending")))
      .limit(1);
    return r ? { id: r.id, appointmentId: r.appointmentId, clientId: r.clientId, kind: r.kind as ChangeKind } : null;
  });
}

/** Resolve a request (approved/declined/withdrawn). RLS-scoped. */
export async function resolveChangeRequestDb(orgId: string, requestId: string, status: ChangeStatus, resolvedBy: string): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(appointmentChangeRequests)
    .set({ status, resolvedBy, resolvedAt: new Date() })
    .where(and(eq(appointmentChangeRequests.id, requestId), eq(appointmentChangeRequests.orgId, orgId))));
}
