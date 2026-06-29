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
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { AppointmentView, DataProvider, HubOverview } from "@/lib/data-provider";
import { computeHubOverview } from "@/lib/domain/dashboards";
import { desc, inArray } from "drizzle-orm";
import type { Appointment, CarePlan, Client, ClientDocument, ConsentRecord, Counsellor, Funder, Grant, Invoice, Org, Room, Service, Site } from "@/lib/domain/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import type { AppointmentState, AppointmentType, ConsentPurpose, ConsentState, CredentialBody, CredentialStatus, Province, RoomStatus } from "@/lib/domain/enums";
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
  appointments as appointmentsTable,
  carePlans as carePlansTable,
  clientDocuments as clientDocumentsTable,
  invoices as invoicesTable,
  funders as fundersTable,
  grants as grantsTable,
  funderContacts as funderContactsTable,
  outcomeMeasures as outcomeMeasuresTable,
} from "@/db/schema";

function toGrant(r: typeof grantsTable.$inferSelect): Grant {
  return { id: r.id, funderId: r.funderId, orgId: r.orgId, title: r.title, periodStart: r.periodStart, periodEnd: r.periodEnd, amountCents: r.amountCents, restricted: r.restricted, reportingSchedule: r.reportingSchedule as Grant["reportingSchedule"], status: r.status as Grant["status"] };
}

function toInvoice(r: typeof invoicesTable.$inferSelect): Invoice {
  return { id: r.id, clientId: r.clientId, orgId: r.orgId, number: r.number, serviceName: r.serviceName, amountCents: r.amountCents, status: r.status as PaymentStatus, issuedAt: r.issuedAt.toISOString(), dueAt: r.dueAt.toISOString() };
}

type ApptRow = typeof appointmentsTable.$inferSelect;
function toAppt(r: ApptRow): Appointment {
  return {
    id: r.id, orgId: r.orgId, clientId: r.clientId, counsellorId: r.counsellorId, serviceId: r.serviceId,
    type: r.type as AppointmentType, roomId: r.roomId, startsAt: r.startsAt.toISOString(),
    durationMin: r.durationMin, state: r.state as AppointmentState, tags: r.tags,
  };
}
/** Inclusive [from, to] day-range predicate over a timestamptz column. */
function dayRange(col: typeof appointmentsTable.startsAt, opts?: { from?: string; to?: string }) {
  const bounds = [];
  if (opts?.from) bounds.push(gte(col, new Date(`${opts.from}T00:00:00+02:00`)));
  if (opts?.to) bounds.push(lte(col, new Date(`${opts.to}T23:59:59+02:00`)));
  return bounds;
}

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

  // ── Scheduling cluster — real appointments from the DB ────────────────
  listAppointmentsForCounsellor: async (counsellorId: string, opts?: { from?: string; to?: string }): Promise<Appointment[]> => {
    const rows = await getDb().select().from(appointmentsTable).where(and(eq(appointmentsTable.counsellorId, counsellorId), ...dayRange(appointmentsTable.startsAt, opts)));
    return rows.map(toAppt);
  },
  listAppointmentsForOrg: async (orgId: string, opts?: { from?: string; to?: string }): Promise<Appointment[]> => {
    const rows = await getDb().select().from(appointmentsTable).where(and(eq(appointmentsTable.orgId, orgId), ...dayRange(appointmentsTable.startsAt, opts)));
    return rows.map(toAppt);
  },
  listCounsellorSessions: async (counsellorId: string): Promise<AppointmentView[]> => {
    const rows = await getDb()
      .select({ a: appointmentsTable, clientName: clientsTable.name, serviceName: servicesTable.name, counsellorName: counsellorsTable.name, roomName: roomsTable.name })
      .from(appointmentsTable)
      .leftJoin(clientsTable, eq(appointmentsTable.clientId, clientsTable.id))
      .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .leftJoin(counsellorsTable, eq(appointmentsTable.counsellorId, counsellorsTable.id))
      .leftJoin(roomsTable, eq(appointmentsTable.roomId, roomsTable.id))
      .where(eq(appointmentsTable.counsellorId, counsellorId));
    return rows
      .map((r) => ({ ...toAppt(r.a), clientName: r.clientName ?? "Unknown client", serviceName: r.serviceName ?? "Session", counsellorName: r.counsellorName ?? "", roomName: r.roomName ?? null }))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  },

  // ── Clinical cluster — care plan (shared) + documents ─────────────────
  getCarePlan: async (clientId: string): Promise<CarePlan | null> => {
    const [r] = await getDb().select().from(carePlansTable).where(eq(carePlansTable.clientId, clientId)).limit(1);
    return r ? { id: r.id, clientId: r.clientId, authorCounsellorId: r.authorCounsellorId, summary: r.summary, tasks: r.tasks, resources: r.resources, nextStep: r.nextStep, sharedAt: r.sharedAt ? r.sharedAt.toISOString() : null } : null;
  },
  listClientDocuments: async (clientId: string): Promise<ClientDocument[]> => {
    const rows = await getDb().select().from(clientDocumentsTable).where(eq(clientDocumentsTable.clientId, clientId));
    return rows.map((d) => ({ id: d.id, clientId: d.clientId, orgId: d.orgId, name: d.name, kind: d.kind as ClientDocument["kind"], sizeLabel: d.sizeLabel, sharedBy: d.sharedBy as ClientDocument["sharedBy"], createdAt: d.createdAt.toISOString() }));
  },

  // ── Billing cluster — invoices ────────────────────────────────────────
  listClientInvoices: async (clientId: string): Promise<Invoice[]> => {
    const rows = await getDb().select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId)).orderBy(desc(invoicesTable.issuedAt));
    return rows.map(toInvoice);
  },
  listOrgInvoices: async (orgId: string): Promise<Invoice[]> => {
    const rows = await getDb().select().from(invoicesTable).where(eq(invoicesTable.orgId, orgId)).orderBy(desc(invoicesTable.issuedAt));
    return rows.map(toInvoice);
  },

  // ── Composite dashboard — Hub overview, aggregated from DB rows ───────
  getHubOverview: async (orgId: string, now: string): Promise<HubOverview | null> => {
    const db = getDb();
    const [org] = await db.select({ id: orgsTable.id }).from(orgsTable).where(eq(orgsTable.id, orgId)).limit(1);
    if (!org) return null;
    const [counsellorRows, clientRows, apptRows, invoiceRows, serviceRows, outcomeRows] = await Promise.all([
      db.select().from(counsellorsTable).where(eq(counsellorsTable.orgId, orgId)),
      db.select().from(clientsTable).where(and(eq(clientsTable.orgId, orgId), isNull(clientsTable.deletedAt))),
      db.select().from(appointmentsTable).where(eq(appointmentsTable.orgId, orgId)),
      db.select().from(invoicesTable).where(eq(invoicesTable.orgId, orgId)),
      db.select().from(servicesTable).where(eq(servicesTable.orgId, orgId)),
      db.selectDistinct({ clientId: outcomeMeasuresTable.clientId }).from(outcomeMeasuresTable),
    ]);
    return computeHubOverview({
      counsellors: counsellorRows.map(toCounsellor),
      clients: clientRows.map(toClient),
      appointments: apptRows.map(toAppt),
      invoices: invoiceRows.map(toInvoice),
      services: serviceRows.map((s) => ({ id: s.id, orgId: s.orgId, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents })),
      measuredClientIds: new Set(outcomeRows.map((r) => r.clientId)),
      now,
    });
  },

  // ── Funders & grants — funder list + funder-scoped grants ─────────────
  listFunders: async (orgId: string): Promise<Funder[]> => {
    const rows = await getDb().select().from(fundersTable).where(eq(fundersTable.orgId, orgId));
    return rows.map((f) => ({ id: f.id, orgId: f.orgId, name: f.name, type: f.type as Funder["type"], contactName: f.contactName, contactEmail: f.contactEmail }));
  },
  listFunderGrants: async (funderUserId: string): Promise<{ grant: Grant; funderName: string; orgName: string }[]> => {
    const db = getDb();
    const contacts = await db.select().from(funderContactsTable).where(eq(funderContactsTable.userId, funderUserId));
    const grantIds = contacts.flatMap((c) => c.grantIds);
    if (grantIds.length === 0) return [];
    const rows = await db
      .select({ grant: grantsTable, funderName: fundersTable.name, orgName: orgsTable.name })
      .from(grantsTable)
      .leftJoin(fundersTable, eq(grantsTable.funderId, fundersTable.id))
      .leftJoin(orgsTable, eq(grantsTable.orgId, orgsTable.id))
      .where(inArray(grantsTable.id, grantIds));
    return rows.map((r) => ({ grant: toGrant(r.grant), funderName: r.funderName ?? "", orgName: r.orgName ?? "" }));
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
