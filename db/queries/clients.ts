import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import type { Province } from "@/lib/domain/enums";

/**
 * Client writes (Phase 10/11)  real, org-scoped persistence for the hub caseload.
 * Every write is scoped by `orgId` (the tenant boundary) as well as the row id, so a
 * hub admin can only ever touch their own org's clients. Removal is a **soft delete**
 * (`deletedAt`)  the record + full history are retained (Outcome-Honesty Rule), and
 * a restore just clears the timestamp.
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
}

/** Insert a new client onto the org's caseload. Returns the new id. */
export async function createClientDb(orgId: string, input: ClientWriteInput, now: string): Promise<{ id: string }> {
  const id = rid("cl");
  await getDb().insert(clients).values({
    id,
    orgId,
    name: input.name.trim(),
    phone: clean(input.phone),
    email: clean(input.email),
    province: input.province,
    primaryCounsellorId: input.counsellorId,
    riskFlag: input.riskFlag,
    createdAt: new Date(now),
  });
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
  for (let i = 0; i < values.length; i += CHUNK) {
    await getDb().insert(clients).values(values.slice(i, i + CHUNK));
  }
  return values.length;
}

/** Update every editable field on a client, scoped to the org. */
export async function updateClientDb(orgId: string, clientId: string, input: ClientWriteInput): Promise<void> {
  await getDb()
    .update(clients)
    .set({
      name: input.name.trim(),
      phone: clean(input.phone),
      email: clean(input.email),
      province: input.province,
      primaryCounsellorId: input.counsellorId,
      riskFlag: input.riskFlag,
    })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)));
}

/** Soft-delete (removed=true) or restore (removed=false) a client. */
export async function setClientRemovedDb(orgId: string, clientId: string, removed: boolean, now: string): Promise<void> {
  await getDb()
    .update(clients)
    .set({ deletedAt: removed ? new Date(now) : null })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)));
}

/** Move a client to another primary counsellor (their history moves with them). */
export async function reassignClientDb(orgId: string, clientId: string, counsellorId: string): Promise<void> {
  await getDb()
    .update(clients)
    .set({ primaryCounsellorId: counsellorId })
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)));
}
