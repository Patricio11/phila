import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { companies, companyPayments, clients, appointments, services, waitlistEntries } from "@/db/schema";

/**
 * EAP companies (batch 2j) - an employer pays a retainer; its employees book as
 * ordinary clients, invisibly linked by `clients.company_id`. Everything the
 * COMPANY ever receives is aggregate-only: amounts, session counts, months -
 * never a name, never a diagnosis. The org sees its own clients as always;
 * the boundary is what leaves the building.
 */

/** States that draw down the retainer - sessions that actually happened. */
const HELD = ["completed", "discharged"];

export type CompanyBookingMode = "self_book" | "practice_books";

export interface CompanySummary {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  sessionRateCents: number | null;
  bookingToken: string;
  notes: string | null;
  /** Batch 2t - who books: the employee, or the practice from the waitlist. */
  bookingMode: CompanyBookingMode;
  /** The intake form employees fill when the practice books. */
  intakeFormId: string | null;
  paidCents: number;
  usedCents: number;
  remainingCents: number;
  employeeCount: number;
  sessionsHeld: number;
  sessionsUpcoming: number;
}

export interface CompanyDetail extends CompanySummary {
  payments: { id: string; amountCents: number; note: string | null; paidAt: string }[];
  /** "YYYY-MM" -> sessions held + cents drawn that month. Aggregate only. */
  monthly: { month: string; sessions: number; cents: number }[];
}

const newToken = () => randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12).padEnd(12, "x");
const rid = () => `comp_${randomBytes(6).toString("hex")}`;

export async function createCompanyDb(orgId: string, input: { name: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; sessionRateCents?: number | null; notes?: string | null; bookingMode?: CompanyBookingMode; intakeFormId?: string | null }): Promise<{ id: string; bookingToken: string }> {
  return runForOrg(orgId, async () => {
    const id = rid();
    const bookingToken = newToken();
    await activeDb().insert(companies).values({
      id, orgId, name: input.name,
      contactName: input.contactName ?? null, contactEmail: input.contactEmail ?? null, contactPhone: input.contactPhone ?? null,
      sessionRateCents: input.sessionRateCents ?? null, bookingToken, notes: input.notes ?? null,
      bookingMode: input.bookingMode ?? "self_book", intakeFormId: input.intakeFormId ?? null,
    });
    return { id, bookingToken };
  });
}

export async function updateCompanyDb(orgId: string, companyId: string, input: { name: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null; sessionRateCents: number | null; notes: string | null; bookingMode?: CompanyBookingMode; intakeFormId?: string | null }): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(companies).set(input)
      .where(and(eq(companies.id, companyId), eq(companies.orgId, orgId)))
      .returning({ id: companies.id });
    return res.length > 0;
  });
}

export async function recordCompanyPaymentDb(orgId: string, companyId: string, amountCents: number, note: string | null): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [c] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.orgId, orgId))).limit(1);
    if (!c) return false;
    await db.insert(companyPayments).values({ orgId, companyId, amountCents, note });
    return true;
  });
}

/** Usage for a set of companies: held sessions of linked clients x rate (or list price). */
async function usage(orgId: string, comps: (typeof companies.$inferSelect)[], nowISO: string) {
  const db = activeDb();
  const ids = comps.map((c) => c.id);
  if (ids.length === 0) return new Map<string, { employees: number; held: { startsAt: Date; cents: number; companyId: string }[]; upcoming: number }>();
  const linked = await db.select({ id: clients.id, companyId: clients.companyId }).from(clients)
    .where(and(eq(clients.orgId, orgId), inArray(clients.companyId, ids), isNull(clients.deletedAt)));
  const clientIds = linked.map((l) => l.id);
  const companyOf = new Map(linked.map((l) => [l.id, l.companyId!]));
  const rateOf = new Map(comps.map((c) => [c.id, c.sessionRateCents]));
  const appts = clientIds.length
    ? await db.select({ clientId: appointments.clientId, startsAt: appointments.startsAt, state: appointments.state, priceCents: services.priceCents })
        .from(appointments).leftJoin(services, eq(appointments.serviceId, services.id))
        .where(and(eq(appointments.orgId, orgId), inArray(appointments.clientId, clientIds)))
    : [];
  const nowMs = new Date(nowISO).getTime();
  const out = new Map<string, { employees: number; held: { startsAt: Date; cents: number; companyId: string }[]; upcoming: number }>();
  for (const c of comps) out.set(c.id, { employees: 0, held: [], upcoming: 0 });
  for (const l of linked) out.get(l.companyId!)!.employees += 1;
  for (const a of appts) {
    const compId = companyOf.get(a.clientId);
    if (!compId) continue;
    const agg = out.get(compId)!;
    if (HELD.includes(a.state)) {
      agg.held.push({ startsAt: a.startsAt, cents: rateOf.get(compId) ?? a.priceCents ?? 0, companyId: compId });
    } else if (a.state === "scheduled" && a.startsAt.getTime() > nowMs) {
      agg.upcoming += 1;
    }
  }
  return out;
}

function summarise(c: typeof companies.$inferSelect, paid: number, agg: { employees: number; held: { cents: number }[]; upcoming: number }): CompanySummary {
  const usedCents = agg.held.reduce((s, h) => s + h.cents, 0);
  return {
    id: c.id, name: c.name, contactName: c.contactName, contactEmail: c.contactEmail, contactPhone: c.contactPhone,
    sessionRateCents: c.sessionRateCents, bookingToken: c.bookingToken, notes: c.notes,
    bookingMode: (c.bookingMode === "practice_books" ? "practice_books" : "self_book") as CompanyBookingMode,
    intakeFormId: c.intakeFormId ?? null,
    paidCents: paid, usedCents, remainingCents: paid - usedCents,
    employeeCount: agg.employees, sessionsHeld: agg.held.length, sessionsUpcoming: agg.upcoming,
  };
}

/**
 * Batch 2p - just how many companies the practice has. The Clients page shows
 * this on its Companies button, and it should not pay for the whole usage
 * rollup to print one number.
 */
export async function countCompaniesDb(orgId: string): Promise<number> {
  return runForOrg(orgId, async () => {
    const rows = await activeDb().select({ id: companies.id }).from(companies).where(eq(companies.orgId, orgId));
    return rows.length;
  });
}

export async function listCompaniesDb(orgId: string, nowISO: string): Promise<CompanySummary[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const comps = await db.select().from(companies).where(eq(companies.orgId, orgId));
    const pays = comps.length ? await db.select().from(companyPayments).where(inArray(companyPayments.companyId, comps.map((c) => c.id))) : [];
    const aggs = await usage(orgId, comps, nowISO);
    return comps
      .map((c) => summarise(c, pays.filter((p) => p.companyId === c.id).reduce((s, p) => s + p.amountCents, 0), aggs.get(c.id)!))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function companyDetailDb(orgId: string, companyId: string, nowISO: string): Promise<CompanyDetail | null> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [c] = await db.select().from(companies).where(and(eq(companies.id, companyId), eq(companies.orgId, orgId))).limit(1);
    if (!c) return null;
    const pays = await db.select().from(companyPayments).where(eq(companyPayments.companyId, companyId)).orderBy(desc(companyPayments.paidAt));
    const aggs = await usage(orgId, [c], nowISO);
    const agg = aggs.get(c.id)!;
    const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit" });
    const byMonth = new Map<string, { sessions: number; cents: number }>();
    for (const h of agg.held) {
      const k = monthKey.format(h.startsAt);
      const m = byMonth.get(k) ?? { sessions: 0, cents: 0 };
      m.sessions += 1; m.cents += h.cents;
      byMonth.set(k, m);
    }
    return {
      ...summarise(c, pays.reduce((s, p) => s + p.amountCents, 0), agg),
      payments: pays.map((p) => ({ id: p.id, amountCents: p.amountCents, note: p.note, paidAt: p.paidAt.toISOString() })),
      monthly: [...byMonth.entries()].map(([month, v]) => ({ month, ...v })).sort((a, b) => b.month.localeCompare(a.month)),
    };
  });
}

/**
 * Resolve an employee booking token to its company (public flow - owner read,
 * token IS the credential). Returns just enough for the booking to link up.
 */
export async function companyByTokenDb(token: string): Promise<{ id: string; orgId: string; name: string; bookingMode: CompanyBookingMode; intakeFormId: string | null } | null> {
  const [c] = await getDb().select({
    id: companies.id, orgId: companies.orgId, name: companies.name,
    bookingMode: companies.bookingMode, intakeFormId: companies.intakeFormId,
  }).from(companies).where(eq(companies.bookingToken, token)).limit(1);
  if (!c) return null;
  return { ...c, bookingMode: (c.bookingMode === "practice_books" ? "practice_books" : "self_book") as CompanyBookingMode };
}

/**
 * Batch 2t - the employees the PRACTICE can see: who is linked to this company,
 * where each one stands, and when they were last seen. Org-facing only; nothing
 * here ever reaches the employer, whose reporting stays aggregate.
 */
export interface CompanyEmployee {
  clientId: string;
  name: string;
  addedAt: string;
  waiting: boolean;
  waitlistId: string | null;
  sessionsHeld: number;
  nextAt: string | null;
  lastAt: string | null;
}

export async function companyEmployeesDb(orgId: string, companyId: string, nowISO: string): Promise<CompanyEmployee[]> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const people = await db.select({ id: clients.id, name: clients.name, createdAt: clients.createdAt })
      .from(clients)
      .where(and(eq(clients.orgId, orgId), eq(clients.companyId, companyId), isNull(clients.deletedAt)));
    if (people.length === 0) return [];
    const ids = people.map((p) => p.id);
    const [appts, waiting] = await Promise.all([
      db.select({ clientId: appointments.clientId, startsAt: appointments.startsAt, state: appointments.state })
        .from(appointments).where(and(eq(appointments.orgId, orgId), inArray(appointments.clientId, ids))),
      db.select({ id: waitlistEntries.id, clientId: waitlistEntries.clientId })
        .from(waitlistEntries)
        .where(and(eq(waitlistEntries.orgId, orgId), eq(waitlistEntries.status, "waiting"), inArray(waitlistEntries.clientId, ids))),
    ]);
    const nowMs = new Date(nowISO).getTime();
    const waitingOf = new Map(waiting.map((w) => [w.clientId, w.id]));
    return people
      .map((p): CompanyEmployee => {
        const mine = appts.filter((a) => a.clientId === p.id);
        const held = mine.filter((a) => HELD.includes(a.state));
        const future = mine
          .filter((a) => a.state === "scheduled" && a.startsAt.getTime() > nowMs)
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        const past = held.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
        return {
          clientId: p.id, name: p.name, addedAt: p.createdAt.toISOString(),
          waiting: waitingOf.has(p.id), waitlistId: waitingOf.get(p.id) ?? null,
          sessionsHeld: held.length,
          nextAt: future[0]?.startsAt.toISOString() ?? null,
          lastAt: past[0]?.startsAt.toISOString() ?? null,
        };
      })
      .sort((a, b) => Number(b.waiting) - Number(a.waiting) || a.name.localeCompare(b.name));
  });
}
