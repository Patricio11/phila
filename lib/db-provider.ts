/**
 * dbProvider  the Part-B implementation of the `dataProvider` seam, backed by
 * Neon Postgres. It is built as a **hybrid migration layer**: it spreads
 * `mockProvider` as the base, then overrides one method at a time with a real DB
 * read/write. Methods not yet migrated fall back to the mock  and because the DB
 * is seeded from the same fixtures, mock-fallback and real reads return identical
 * data, so the app stays whole while it goes real (Phase 9 → Phase 17).
 *
 * Identity is already real: the session/guards resolve the principal from
 * `org_members` + `user` (lib/auth/session.ts). RLS becomes the tenant boundary
 * as the write paths migrate (docs/SECURITY.md).
 */
import { and, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import type { AppointmentView, CaseloadRow, CaseloadStatus, ClientDossier, CounsellorDashboard, DataProvider, DuplicateGroup, HubOverview, OutcomePoint, OrgClientRow, OrgSubscription, PlanWithUsage, RoomView, RoomDetail } from "@/lib/data-provider";
import { PLANS, planById } from "@/lib/billing/plans";
import { getSubscriptionRow, listSubscriptions } from "@/db/queries/subscriptions";
import { getReportingDb, getHubInsightsDb } from "@/db/queries/analytics";
import { listGrantsDb, getGrantViewDb, getFunderGrantViewDb } from "@/db/queries/grants";
import { listOrgDocumentsDb, listOrgFoldersDb, listDocumentRequestsDb, getStorageUsageDb, listClientVisibleDocumentsDb, listClientRequestsDb, listCounsellorDocumentsDb } from "@/db/queries/documents";
import { listFormsDb, getFormDb, getActiveIntakeFormDb, getFormResponsesDb, getFormByTokenDb, listClientFormsDb, createFormDb, updateFormDb, duplicateFormDb, setFormStatusDb, setFormShareDb, sendFormToClientsDb, submitFormResponseDb } from "@/db/queries/forms";
import { listTeamThreadsDb } from "@/db/queries/messages";
import { getPublicPageContent, defaultContent } from "@/db/queries/public-page";
import type { OrgPublicPage } from "@/lib/data-provider";
import { computeHubOverview, computeCounsellorDashboard } from "@/lib/domain/dashboards";
import { desc, inArray } from "drizzle-orm";
import type { Appointment, CarePlan, Client, ClientDocument, ConsentRecord, Counsellor, Demographics, Funder, Grant, Invoice, Org, OutcomeMeasure, Room, Service, Site } from "@/lib/domain/types";
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
  demographics as demographicsTable,
  roomAssignments as roomAssignmentsTable,
} from "@/db/schema";
import { isoWeekday, roomUtilisation } from "@/lib/domain/helpers";

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
    durationMin: r.durationMin, state: r.state as AppointmentState, tags: r.tags, seriesId: r.seriesId,
  };
}
/** Inclusive [from, to] day-range predicate over a timestamptz column. */
function dayRange(col: typeof appointmentsTable.startsAt, opts?: { from?: string; to?: string }) {
  const bounds = [];
  if (opts?.from) bounds.push(gte(col, new Date(`${opts.from}T00:00:00+02:00`)));
  if (opts?.to) bounds.push(lte(col, new Date(`${opts.to}T23:59:59+02:00`)));
  return bounds;
}

/** A counsellor's appointments with client/service/room names resolved (joined). */
async function counsellorApptViews(counsellorId: string): Promise<AppointmentView[]> {
  const rows = await getDb()
    .select({ a: appointmentsTable, clientName: clientsTable.name, serviceName: servicesTable.name, counsellorName: counsellorsTable.name, roomName: roomsTable.name })
    .from(appointmentsTable)
    .leftJoin(clientsTable, eq(appointmentsTable.clientId, clientsTable.id))
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .leftJoin(counsellorsTable, eq(appointmentsTable.counsellorId, counsellorsTable.id))
    .leftJoin(roomsTable, eq(appointmentsTable.roomId, roomsTable.id))
    .where(eq(appointmentsTable.counsellorId, counsellorId));
  return rows.map((r) => ({ ...toAppt(r.a), clientName: r.clientName ?? "Unknown client", serviceName: r.serviceName ?? "Session", counsellorName: r.counsellorName ?? "", roomName: r.roomName ?? null }));
}

/** All of an org's appointments as joined views (client/service/counsellor/room names). */
async function orgApptViews(orgId: string): Promise<AppointmentView[]> {
  const rows = await getDb()
    .select({ a: appointmentsTable, clientName: clientsTable.name, serviceName: servicesTable.name, counsellorName: counsellorsTable.name, roomName: roomsTable.name })
    .from(appointmentsTable)
    .leftJoin(clientsTable, eq(appointmentsTable.clientId, clientsTable.id))
    .leftJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .leftJoin(counsellorsTable, eq(appointmentsTable.counsellorId, counsellorsTable.id))
    .leftJoin(roomsTable, eq(appointmentsTable.roomId, roomsTable.id))
    .where(eq(appointmentsTable.orgId, orgId));
  return rows.map((r) => ({ ...toAppt(r.a), clientName: r.clientName ?? "Unknown client", serviceName: r.serviceName ?? "Session", counsellorName: r.counsellorName ?? "", roomName: r.roomName ?? null }));
}

const HELD_STATES = ["completed", "no_show", "risk_flagged", "discharged"];

function caseStatusFrom(client: Client, appts: AppointmentView[], nowMs: number): { status: CaseloadStatus; nextSession: AppointmentView | null; lastSession: AppointmentView | null; held: number } {
  const sorted = [...appts].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sorted.filter((a) => new Date(a.startsAt).getTime() <= nowMs);
  const future = sorted.filter((a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled");
  const held = past.filter((a) => HELD_STATES.includes(a.state));
  const lastSession = past[past.length - 1] ?? null;
  const status: CaseloadStatus = client.riskFlag
    ? "at_risk"
    : held.length === 0
      ? "new"
      : lastSession && nowMs - new Date(lastSession.startsAt).getTime() > 60 * 86_400_000
        ? "inactive"
        : "active";
  return { status, nextSession: future[0] ?? null, lastSession, held: held.length };
}

/** Org clients as hub rows. `removed` selects the Removed tab (soft-deleted) vs the live caseload. */
async function orgClientRowsDb(orgId: string, now: string, removed: boolean): Promise<OrgClientRow[]> {
  const db = getDb();
  const [clientRows, counsellorRows, views] = await Promise.all([
    db.select().from(clientsTable).where(and(eq(clientsTable.orgId, orgId), removed ? isNotNull(clientsTable.deletedAt) : isNull(clientsTable.deletedAt))),
    db.select().from(counsellorsTable).where(eq(counsellorsTable.orgId, orgId)),
    orgApptViews(orgId),
  ]);
  const nowMs = new Date(now).getTime();
  return clientRows.map((cr): OrgClientRow => {
    const client = toClient(cr);
    const { status, nextSession, lastSession } = caseStatusFrom(client, views.filter((v) => v.clientId === client.id), nowMs);
    const counsellor = counsellorRows.find((c) => c.id === client.primaryCounsellorId);
    return { client, counsellorName: counsellor?.name ?? "Unassigned", nextSession, lastSession, status };
  });
}

/* SAST date helpers (fixed +02:00, no DST) for the weekly room window. */
function sastDateOf(nowISO: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowISO));
}
function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** The 7 dates (Mon→Sun) of the ISO week containing `now`. */
function weekDatesOf(nowISO: string): string[] {
  const today = sastDateOf(nowISO);
  const monday = addDaysIso(today, -(isoWeekday(today) - 1));
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
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
    clientPortal: {
      inviteOnBooking: Boolean((row.clientPortal as Record<string, boolean>)?.inviteOnBooking),
      inviteOnCreate: Boolean((row.clientPortal as Record<string, boolean>)?.inviteOnCreate),
    },
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

  // Phila subscription (Phase 15A)  read from the subscriptions table.
  getOrgSubscription: async (orgId: string, now: string): Promise<OrgSubscription | null> => {
    const sub = await getSubscriptionRow(orgId);
    if (!sub) return null;
    const plan = planById(sub.planId);
    if (!plan || (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due")) return null;
    const d = new Date(now);
    const nextBillingAt = sub.currentPeriodEnd ?? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
    return { plan, status: sub.status, nextBillingAt, billedVia: "Phila platform billing" };
  },

  listPlans: async (): Promise<PlanWithUsage[]> => {
    const subs = await listSubscriptions();
    return PLANS.map((plan) => {
      const active = subs.filter((s) => s.planId === plan.id && s.status === "active");
      return { plan, subscribers: active.length, mrrCents: active.length * plan.priceCents };
    });
  },

  // Public micro-site (Phase 17)  real content from org_public_pages (no mock).
  getOrgPublicPage: async (slug: string): Promise<OrgPublicPage | null> => {
    const db = getDb();
    const [orgRow] = await db.select().from(orgsTable).where(eq(orgsTable.slug, slug)).limit(1);
    if (!orgRow || orgRow.deletedAt) return null;
    const org = toOrg(orgRow);
    const [sites, services, counsellors, content] = await Promise.all([
      db.select().from(sitesTable).where(eq(sitesTable.orgId, org.id)),
      db.select().from(servicesTable).where(eq(servicesTable.orgId, org.id)),
      db.select().from(counsellorsTable).where(eq(counsellorsTable.orgId, org.id)),
      getPublicPageContent(org.id),
    ]);
    const c = content ?? defaultContent({ intro: "", about: "" });
    return {
      org,
      intro: c.heroSubtitle,
      about: c.aboutBody,
      sites: sites.map((s) => ({ id: s.id, orgId: s.orgId, name: s.name, province: s.province as Province })),
      offersOnline: c.showOnlineBadge,
      services: services.map((s) => ({ id: s.id, orgId: s.orgId, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents })),
      team: counsellors.map(toCounsellor),
      content: c,
    };
  },

  // Analytics & M&E reporting (Phase 16)  real, computed from the clinical tables.
  // (listFunders + listFunderGrants are already DB-backed below.)
  getReporting: (orgId, now, filters) => getReportingDb(orgId, now, filters),
  getHubInsights: (orgId, now, filters) => getHubInsightsDb(orgId, now, filters),
  listGrants: (orgId) => listGrantsDb(orgId),
  getGrantView: (grantId, now) => getGrantViewDb(grantId, now),
  getFunderGrantView: (funderUserId, grantId, now) => getFunderGrantViewDb(funderUserId, grantId, now),

  // Documents (Phase 18)  the org's document workspace, real DB reads.
  listOrgDocuments: (orgId) => listOrgDocumentsDb(orgId),
  listOrgFolders: (orgId) => listOrgFoldersDb(orgId),
  listDocumentRequests: (orgId) => listDocumentRequestsDb(orgId),
  getStorageUsage: (orgId) => getStorageUsageDb(orgId),
  listClientVisibleDocuments: (clientId) => listClientVisibleDocumentsDb(clientId),
  listClientDocumentRequests: (clientId) => listClientRequestsDb(clientId),
  listCounsellorDocuments: (counsellorId) => listCounsellorDocumentsDb(counsellorId),
  listTeamThreads: (userId, orgId) => listTeamThreadsDb(userId, orgId),

  // Forms library (Phase 18.6)  real DB reads + writes. Intake for booking now
  // resolves the active intake form from `forms` (falls back to mock if unseeded).
  listForms: (orgId) => listFormsDb(orgId),
  getForm: (orgId, formId) => getFormDb(orgId, formId),
  getFormResponses: (orgId, formId) => getFormResponsesDb(orgId, formId),
  createForm: (orgId, draft, createdBy, now) => createFormDb(orgId, draft, createdBy, now),
  updateForm: (orgId, formId, draft, now) => updateFormDb(orgId, formId, draft, now),
  duplicateForm: (orgId, formId, now) => duplicateFormDb(orgId, formId, now),
  setFormStatus: (orgId, formId, status, now) => setFormStatusDb(orgId, formId, status, now),
  sendFormToClients: (orgId, formId, clientIds, sentBy, now) => sendFormToClientsDb(orgId, formId, clientIds, sentBy, now),
  setFormShare: (orgId, formId, enabled, now) => setFormShareDb(orgId, formId, enabled, now),
  getFormByToken: (tok) => getFormByTokenDb(tok),
  submitFormResponse: (tok, answers, now) => submitFormResponseDb(tok, answers, now),
  listClientForms: (clientId) => listClientFormsDb(clientId),
  getIntakeForm: async (orgId) => (await getActiveIntakeFormDb(orgId)) ?? mockProvider.getIntakeForm(orgId),

  // The public booking config keeps its mock-sourced settings (booking policy +
  // intake form, persisted in later phases) but swaps in the REAL org so the
  // availability engine honours the practice's actual (persisted) business hours.
  getBookingConfig: async (slug: string) => {
    const base = await mockProvider.getBookingConfig(slug);
    if (!base) return null;
    const [row] = await getDb().select().from(orgsTable).where(eq(orgsTable.slug, slug)).limit(1);
    return row && !row.deletedAt ? { ...base, org: toOrg(row) } : base;
  },

  // ── Directory cluster  single-table reads from the DB ────────────────
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

  // ── Rooms cluster  utilisation rolled up from REAL appointments ───────
  getRoomsOverview: async (orgId: string, now: string): Promise<RoomView[]> => {
    const db = getDb();
    const [[orgRow], roomRows, siteRows, counsellorRows, views, assignmentRows] = await Promise.all([
      db.select().from(orgsTable).where(eq(orgsTable.id, orgId)).limit(1),
      db.select().from(roomsTable).where(eq(roomsTable.orgId, orgId)),
      db.select().from(sitesTable).where(eq(sitesTable.orgId, orgId)),
      db.select().from(counsellorsTable).where(eq(counsellorsTable.orgId, orgId)),
      orgApptViews(orgId),
      db.select().from(roomAssignmentsTable).where(eq(roomAssignmentsTable.orgId, orgId)),
    ]);
    if (!orgRow) return [];
    const org = toOrg(orgRow);
    const weekDates = weekDatesOf(now);
    return roomRows.map((r): RoomView => {
      const room = toRoom(r);
      const roomAppts = views.filter((a) => a.roomId === room.id);
      return {
        room,
        siteName: siteRows.find((s) => s.id === room.siteId)?.name ?? "",
        utilisation: roomUtilisation({ appointments: roomAppts, businessHours: org.scheduling.businessHours, weekDates }),
        assignments: assignmentRows.filter((ra) => ra.roomId === room.id).map((ra) => ({ counsellorName: counsellorRows.find((c) => c.id === ra.counsellorId)?.name ?? "", days: ra.days, start: ra.start, end: ra.end })),
        bookings: roomAppts.filter((a) => weekDates.some((d) => a.startsAt.startsWith(d))).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      };
    });
  },

  getRoomDetail: async (roomId: string, now: string): Promise<RoomDetail | null> => {
    const db = getDb();
    const [roomRow] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId)).limit(1);
    if (!roomRow) return null;
    const room = toRoom(roomRow);
    const [[orgRow], siteRows, counsellorRows, views, assignmentRows] = await Promise.all([
      db.select().from(orgsTable).where(eq(orgsTable.id, room.orgId)).limit(1),
      db.select().from(sitesTable).where(eq(sitesTable.orgId, room.orgId)),
      db.select().from(counsellorsTable).where(eq(counsellorsTable.orgId, room.orgId)),
      orgApptViews(room.orgId),
      db.select().from(roomAssignmentsTable).where(eq(roomAssignmentsTable.orgId, room.orgId)),
    ]);
    if (!orgRow) return null;
    const bh = toOrg(orgRow).scheduling.businessHours;
    const weekDates = weekDatesOf(now);
    const today = sastDateOf(now);
    const roomAppts = views.filter((a) => a.roomId === room.id);
    const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    const openMinutes = (date: string) => {
      const h = bh[isoWeekday(date)];
      if (!h) return 0;
      const breaks = (h.breaks ?? []).reduce((s, b) => s + (toMin(b.end) - toMin(b.start)), 0);
      return Math.max(0, toMin(h.end) - toMin(h.start) - breaks);
    };
    const perDay = weekDates.map((date) => {
      const openMin = openMinutes(date);
      const bookedMin = roomAppts.filter((a) => a.startsAt.startsWith(date) && a.state !== "cancelled").reduce((s, a) => s + a.durationMin, 0);
      return { date, dow: isoWeekday(date), openMin, bookedMin, freeMin: Math.max(0, openMin - bookedMin), pct: openMin === 0 ? 0 : Math.min(100, Math.round((bookedMin / openMin) * 100)), isToday: date === today };
    });
    return {
      room,
      siteName: siteRows.find((s) => s.id === room.siteId)?.name ?? "",
      businessHours: bh,
      utilisation: roomUtilisation({ appointments: roomAppts, businessHours: bh, weekDates }),
      perDay,
      freeHours: Math.round((perDay.reduce((s, d) => s + d.freeMin, 0) / 60) * 10) / 10,
      capacityNote: `Seats ${room.capacity}${room.equipment.length ? ` · ${room.equipment.join(", ")}` : ""}`,
      assignments: assignmentRows.filter((ra) => ra.roomId === room.id).map((ra) => ({ counsellorName: counsellorRows.find((c) => c.id === ra.counsellorId)?.name ?? "", days: ra.days, start: ra.start, end: ra.end })),
      bookings: roomAppts.filter((a) => weekDates.some((d) => a.startsAt.startsWith(d))).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    };
  },

  // ── Scheduling cluster  real appointments from the DB ────────────────
  listAppointmentsForCounsellor: async (counsellorId: string, opts?: { from?: string; to?: string }): Promise<Appointment[]> => {
    const rows = await getDb().select().from(appointmentsTable).where(and(eq(appointmentsTable.counsellorId, counsellorId), ...dayRange(appointmentsTable.startsAt, opts)));
    return rows.map(toAppt);
  },
  listAppointmentsForOrg: async (orgId: string, opts?: { from?: string; to?: string }): Promise<Appointment[]> => {
    const rows = await getDb().select().from(appointmentsTable).where(and(eq(appointmentsTable.orgId, orgId), ...dayRange(appointmentsTable.startsAt, opts)));
    return rows.map(toAppt);
  },
  listCounsellorSessions: async (counsellorId: string): Promise<AppointmentView[]> => {
    const views = await counsellorApptViews(counsellorId);
    return views.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  },

  // ── Counsellor caseload  live clients + their real appointments ──────
  listCaseload: async (counsellorId: string, now: string): Promise<CaseloadRow[]> => {
    const [clientRows, views] = await Promise.all([
      getDb().select().from(clientsTable).where(and(eq(clientsTable.primaryCounsellorId, counsellorId), isNull(clientsTable.deletedAt))),
      counsellorApptViews(counsellorId),
    ]);
    const nowMs = new Date(now).getTime();
    const HELD = ["completed", "no_show", "risk_flagged", "discharged"];
    return clientRows.map((cr): CaseloadRow => {
      const client = toClient(cr);
      const appts = views.filter((v) => v.clientId === client.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const past = appts.filter((a) => new Date(a.startsAt).getTime() <= nowMs);
      const future = appts.filter((a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled");
      const held = past.filter((a) => HELD.includes(a.state));
      const lastSession = past[past.length - 1] ?? null;
      const status: CaseloadStatus = client.riskFlag
        ? "at_risk"
        : held.length === 0
          ? "new"
          : lastSession && nowMs - new Date(lastSession.startsAt).getTime() > 60 * 86_400_000
            ? "inactive"
            : "active";
      return { client, nextSession: future[0] ?? null, lastSession, sessionCount: held.length, status };
    });
  },

  // ── Hub clients  org caseload, dossier, and duplicate detection (DB) ──
  listOrgClients: (orgId: string, now: string) => orgClientRowsDb(orgId, now, false),
  listRemovedClients: (orgId: string, now: string) => orgClientRowsDb(orgId, now, true),

  getClientDossier: async (clientId: string): Promise<ClientDossier | null> => {
    const db = getDb();
    const [cRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!cRow) return null;
    const client = toClient(cRow);
    const [orgRow] = await db.select().from(orgsTable).where(eq(orgsTable.id, client.orgId)).limit(1);
    const counsRows = client.primaryCounsellorId
      ? await db.select().from(counsellorsTable).where(eq(counsellorsTable.id, client.primaryCounsellorId)).limit(1)
      : [];
    if (!orgRow || !counsRows[0]) return null;

    const [consentRows, demoRows, outcomeRows, docRows, carePlanRows, views] = await Promise.all([
      db.select().from(consentsTable).where(eq(consentsTable.clientId, clientId)),
      db.select().from(demographicsTable).where(eq(demographicsTable.clientId, clientId)),
      db.select().from(outcomeMeasuresTable).where(eq(outcomeMeasuresTable.clientId, clientId)),
      db.select().from(clientDocumentsTable).where(eq(clientDocumentsTable.clientId, clientId)),
      db.select().from(carePlansTable).where(eq(carePlansTable.clientId, clientId)).limit(1),
      orgApptViews(client.orgId),
    ]);

    const consents: ConsentRecord[] = consentRows.map((r) => ({
      clientId: r.clientId,
      purpose: r.purpose as ConsentPurpose,
      state: r.state as ConsentState,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
    }));
    const demographicsAllowed = consents.some((c) => c.purpose === "demographics" && c.state === "granted");
    const dRow = demoRows[0];
    const demographics: Demographics | null = demographicsAllowed && dRow
      ? { clientId: dRow.clientId, gender: dRow.gender as Demographics["gender"], populationGroup: dRow.populationGroup as Demographics["populationGroup"], employmentStatus: dRow.employmentStatus as Demographics["employmentStatus"], ageBand: dRow.ageBand as Demographics["ageBand"], province: dRow.province as Province }
      : null;
    const cp = carePlanRows[0];

    return {
      client,
      org: toOrg(orgRow),
      counsellor: toCounsellor(counsRows[0]),
      consents,
      demographics,
      sessions: views.filter((v) => v.clientId === clientId).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      outcomes: outcomeRows.map((o): OutcomeMeasure => ({ id: o.id, clientId: o.clientId, tool: o.tool as OutcomeMeasure["tool"], score: o.score, takenAt: o.takenAt.toISOString() })),
      documents: docRows.map((d) => ({ id: d.id, clientId: d.clientId, orgId: d.orgId, name: d.name, kind: d.kind as ClientDocument["kind"], sizeLabel: d.sizeLabel, sharedBy: d.sharedBy as ClientDocument["sharedBy"], createdAt: d.createdAt.toISOString() })),
      carePlan: cp ? { id: cp.id, clientId: cp.clientId, authorCounsellorId: cp.authorCounsellorId, summary: cp.summary, tasks: cp.tasks, resources: cp.resources, nextStep: cp.nextStep, sharedAt: cp.sharedAt ? cp.sharedAt.toISOString() : null } : null,
    };
  },

  findDuplicateClients: async (orgId: string): Promise<DuplicateGroup[]> => {
    const db = getDb();
    const [clientRows, counsellorRows, views] = await Promise.all([
      db.select().from(clientsTable).where(and(eq(clientsTable.orgId, orgId), isNull(clientsTable.deletedAt))),
      db.select().from(counsellorsTable).where(eq(counsellorsTable.orgId, orgId)),
      orgApptViews(orgId),
    ]);
    const list = clientRows.map(toClient);
    const sessionCount = (id: string) => views.filter((v) => v.clientId === id).length;
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const digits = (s: string) => s.replace(/\D/g, "");

    // Union-find: link clients that share a normalised name, phone, or email.
    const parent = new Map<string, string>(list.map((c) => [c.id, c.id]));
    const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    const keyToIds = new Map<string, string[]>();
    const addKey = (k: string, id: string) => keyToIds.set(k, [...(keyToIds.get(k) ?? []), id]);
    for (const c of list) {
      addKey(`n:${norm(c.name)}`, c.id);
      if (c.phone) addKey(`p:${digits(c.phone)}`, c.id);
      if (c.email) addKey(`e:${norm(c.email)}`, c.id);
    }
    for (const ids of keyToIds.values()) for (let i = 1; i < ids.length; i++) union(ids[0]!, ids[i]!);

    const groups = new Map<string, string[]>();
    for (const c of list) { const r = find(c.id); groups.set(r, [...(groups.get(r) ?? []), c.id]); }

    const result: DuplicateGroup[] = [];
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const cs = ids.map((id) => list.find((c) => c.id === id)!);
      const sameName = new Set(cs.map((c) => norm(c.name))).size === 1;
      const samePhone = cs.every((c) => c.phone) && new Set(cs.map((c) => digits(c.phone!))).size === 1;
      const reason = sameName && samePhone ? "Same name and phone" : sameName ? "Same name" : samePhone ? "Same phone number" : "Shared contact details";
      result.push({
        reason,
        clients: cs
          .map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null, counsellorName: counsellorRows.find((cc) => cc.id === c.primaryCounsellorId)?.name ?? "", sessions: sessionCount(c.id), createdAt: c.createdAt }))
          .sort((a, b) => b.sessions - a.sessions || a.createdAt.localeCompare(b.createdAt)),
      });
    }
    return result;
  },

  // ── Composite dashboard  counsellor home, aggregated from DB rows ─────
  getCounsellorDashboard: async (counsellorId: string, now: string): Promise<CounsellorDashboard | null> => {
    const db = getDb();
    const [cRow] = await db.select().from(counsellorsTable).where(eq(counsellorsTable.id, counsellorId)).limit(1);
    if (!cRow) return null;
    const [orgRow] = await db.select().from(orgsTable).where(eq(orgsTable.id, cRow.orgId)).limit(1);
    if (!orgRow) return null;
    const [appointments, clientRows] = await Promise.all([
      counsellorApptViews(counsellorId),
      db.select().from(clientsTable).where(and(eq(clientsTable.primaryCounsellorId, counsellorId), isNull(clientsTable.deletedAt))),
    ]);
    const counsellorClients = clientRows.map(toClient);
    const clientIds = counsellorClients.map((c) => c.id);
    const measures = clientIds.length ? await db.select().from(outcomeMeasuresTable).where(inArray(outcomeMeasuresTable.clientId, clientIds)) : [];
    const measuredClientIds = new Set(measures.map((m) => m.clientId));
    const outcomePoints: OutcomePoint[] = measures
      .filter((m) => m.tool === "PHQ-9")
      .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
      .map((m) => ({ label: new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short" }).format(m.takenAt), value: m.score }));
    return computeCounsellorDashboard({ counsellor: toCounsellor(cRow), org: toOrg(orgRow), appointments, counsellorClients, measuredClientIds, outcomePoints, now });
  },

  // ── Clinical cluster  care plan (shared) + documents ─────────────────
  getCarePlan: async (clientId: string): Promise<CarePlan | null> => {
    const [r] = await getDb().select().from(carePlansTable).where(eq(carePlansTable.clientId, clientId)).limit(1);
    return r ? { id: r.id, clientId: r.clientId, authorCounsellorId: r.authorCounsellorId, summary: r.summary, tasks: r.tasks, resources: r.resources, nextStep: r.nextStep, sharedAt: r.sharedAt ? r.sharedAt.toISOString() : null } : null;
  },
  listClientDocuments: async (clientId: string): Promise<ClientDocument[]> => {
    const rows = await getDb().select().from(clientDocumentsTable).where(eq(clientDocumentsTable.clientId, clientId));
    return rows.map((d) => ({ id: d.id, clientId: d.clientId, orgId: d.orgId, name: d.name, kind: d.kind as ClientDocument["kind"], sizeLabel: d.sizeLabel, sharedBy: d.sharedBy as ClientDocument["sharedBy"], createdAt: d.createdAt.toISOString() }));
  },

  // ── Billing cluster  invoices ────────────────────────────────────────
  listClientInvoices: async (clientId: string): Promise<Invoice[]> => {
    const rows = await getDb().select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId)).orderBy(desc(invoicesTable.issuedAt));
    return rows.map(toInvoice);
  },
  listOrgInvoices: async (orgId: string): Promise<Invoice[]> => {
    const rows = await getDb().select().from(invoicesTable).where(eq(invoicesTable.orgId, orgId)).orderBy(desc(invoicesTable.issuedAt));
    return rows.map(toInvoice);
  },

  // ── Composite dashboard  Hub overview, aggregated from DB rows ───────
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

  // ── Funders & grants  funder list + funder-scoped grants ─────────────
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

  // Consent  persisted, versioned, purpose-bound (the lawful basis for reads).
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
