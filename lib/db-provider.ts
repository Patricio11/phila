/**
 * dbProvider — the Part-B implementation of the `dataProvider` seam, backed by
 * Neon Postgres. It is built as a **hybrid migration layer**: it spreads
 * `mockProvider` as the base, then overrides one method at a time with a real DB
 * read/write. Methods not yet migrated fall back to the mock — and because the DB
 * is seeded from the same fixtures, mock-fallback and real reads return identical
 * data, so the app stays whole while it goes real (Phase 9 → Phase 17).
 *
 * Identity is already real: the session/guards resolve the principal from
 * `org_members` + `user` (lib/auth/session.ts). RLS becomes the tenant boundary
 * as the write paths migrate (docs/SECURITY.md).
 */
import { and, eq, isNull } from "drizzle-orm";
import type { DataProvider } from "@/lib/data-provider";
import type { Client, ConsentRecord, Counsellor, Org, Room, Service, Site } from "@/lib/domain/types";
import type { ConsentPurpose, ConsentState, CredentialBody, CredentialStatus, Province, RoomStatus } from "@/lib/domain/enums";
import { mockProvider } from "@/lib/mock/provider";
import { getDb } from "@/db/client";
import {
  orgs as orgsTable,
  consents as consentsTable,
  counsellors as counsellorsTable,
  services as servicesTable,
  sites as sitesTable,
  rooms as roomsTable,
  clients as clientsTable,
} from "@/db/schema";

type OrgRow = typeof orgsTable.$inferSelect;

/** Map a DB org row → the domain `Org` shape the app codes against. */
function toOrg(row: OrgRow): Org {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandAccent: row.brandAccent,
    province: row.province as Org["province"],
    timezone: "Africa/Johannesburg",
    features: row.features as Org["features"],
    scheduling: row.scheduling as unknown as Org["scheduling"],
  };
}

function toCounsellor(r: typeof counsellorsTable.$inferSelect): Counsellor {
  return {
    id: r.id,
    userId: r.userId,
    orgId: r.orgId,
    name: r.name,
    credential: { body: r.credentialBody as CredentialBody, registrationNo: r.credentialRegNo ?? undefined, status: r.credentialStatus as CredentialStatus },
    isSupervisor: r.isSupervisor,
    supervisorId: r.supervisorId,
  };
}

function toClient(r: typeof clientsTable.$inferSelect): Client {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    province: r.province as Province,
    primaryCounsellorId: r.primaryCounsellorId,
    riskFlag: r.riskFlag,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

function toRoom(r: typeof roomsTable.$inferSelect): Room {
  return { id: r.id, orgId: r.orgId, siteId: r.siteId, name: r.name, capacity: r.capacity, equipment: r.equipment, status: r.status as RoomStatus, colour: r.colour };
}

export const dbProvider: DataProvider = {
  ...mockProvider,

  // ── Real (DB-backed) ──────────────────────────────────────────────────
  getOrg: async (orgId: string): Promise<Org | null> => {
    const db = getDb();
    const [row] = await db.select().from(orgsTable).where(eq(orgsTable.id, orgId)).limit(1);
    return row && !row.deletedAt ? toOrg(row) : null;
  },

  getOrgBySlug: async (slug: string): Promise<Org | null> => {
    const db = getDb();
    const [row] = await db.select().from(orgsTable).where(eq(orgsTable.slug, slug)).limit(1);
    return row && !row.deletedAt ? toOrg(row) : null;
  },

  // ── Directory cluster — single-table reads from the DB ────────────────
  listCounsellors: async (orgId: string): Promise<Counsellor[]> => {
    const rows = await getDb().select().from(counsellorsTable).where(eq(counsellorsTable.orgId, orgId));
    return rows.map(toCounsellor);
  },
  getCounsellor: async (counsellorId: string): Promise<Counsellor | null> => {
    const [r] = await getDb().select().from(counsellorsTable).where(eq(counsellorsTable.id, counsellorId)).limit(1);
    return r ? toCounsellor(r) : null;
  },
  listClients: async (orgId: string): Promise<Client[]> => {
    const rows = await getDb().select().from(clientsTable).where(and(eq(clientsTable.orgId, orgId), isNull(clientsTable.deletedAt)));
    return rows.map(toClient);
  },
  getClient: async (clientId: string): Promise<Client | null> => {
    const [r] = await getDb().select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    return r && !r.deletedAt ? toClient(r) : null;
  },
  listServices: async (orgId: string): Promise<Service[]> => {
    const rows = await getDb().select().from(servicesTable).where(eq(servicesTable.orgId, orgId));
    return rows.map((s) => ({ id: s.id, orgId: s.orgId, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }));
  },
  listSites: async (orgId: string): Promise<Site[]> => {
    const rows = await getDb().select().from(sitesTable).where(eq(sitesTable.orgId, orgId));
    return rows.map((s) => ({ id: s.id, orgId: s.orgId, name: s.name, province: s.province as Province }));
  },
  listRooms: async (orgId: string): Promise<Room[]> => {
    const rows = await getDb().select().from(roomsTable).where(eq(roomsTable.orgId, orgId));
    return rows.map(toRoom);
  },

  // Consent — persisted, versioned, purpose-bound (the lawful basis for reads).
  getClientConsents: async (clientId: string): Promise<ConsentRecord[]> => {
    const db = getDb();
    const rows = await db.select().from(consentsTable).where(eq(consentsTable.clientId, clientId));
    return rows.map((r) => ({
      clientId: r.clientId,
      purpose: r.purpose as ConsentPurpose,
      state: r.state as ConsentState,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
    }));
  },
};
