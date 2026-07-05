import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { activeDb } from "@/lib/db/scoped";
import { clients, demographics, consents, outcomeMeasures, appointments, invoices } from "@/db/schema";
import type { Demographics } from "@/lib/domain/types";
import type { ReportingResult, ReportingFilters, HubInsights, InsightsFilters } from "@/lib/data-provider";
import { computeReporting, computeInsights, type OutcomeRow, type ApptRow, type InvoiceRow, type ClientRow, type InsightsExtras } from "@/lib/domain/reporting";

/** Phase 16  real analytics from the clinical tables (no mock fallback). */

export async function loadCohort(orgId: string): Promise<{ clientRows: ClientRow[]; consentedIds: Set<string>; demos: Demographics[]; outcomes: OutcomeRow[] }> {
  const db = activeDb();
  const [clientRows, demoRows, consentRows] = await Promise.all([
    db.select({ id: clients.id, createdAt: clients.createdAt }).from(clients).where(and(eq(clients.orgId, orgId), isNull(clients.deletedAt))),
    db.select().from(demographics),
    db.select({ clientId: consents.clientId }).from(consents).where(and(eq(consents.orgId, orgId), eq(consents.purpose, "demographics"), eq(consents.state, "granted"))),
  ]);
  const orgClientIds = new Set(clientRows.map((c) => c.id));
  const consentedIds = new Set(consentRows.map((c) => c.clientId).filter((id) => orgClientIds.has(id)));
  const demos = demoRows.filter((d) => orgClientIds.has(d.clientId)).map((d) => ({ clientId: d.clientId, gender: d.gender, populationGroup: d.populationGroup, employmentStatus: d.employmentStatus, ageBand: d.ageBand, province: d.province })) as Demographics[];
  const outRows = await db.select({ clientId: outcomeMeasures.clientId, tool: outcomeMeasures.tool, score: outcomeMeasures.score, takenAt: outcomeMeasures.takenAt }).from(outcomeMeasures);
  const outcomes: OutcomeRow[] = outRows.filter((o) => orgClientIds.has(o.clientId)).map((o) => ({ clientId: o.clientId, tool: o.tool, score: o.score, takenAt: o.takenAt.toISOString() }));
  return { clientRows: clientRows.map((c) => ({ id: c.id, createdAt: c.createdAt.toISOString() })), consentedIds, demos, outcomes };
}

export async function getReportingDb(orgId: string, now: string, filters: ReportingFilters): Promise<ReportingResult & { improvementRate: number; headline: string[] }> {
  const c = await loadCohort(orgId);
  return computeReporting({ clients: c.clientRows, consentedIds: c.consentedIds, demographics: c.demos, outcomes: c.outcomes }, now, filters);
}

export async function getHubInsightsDb(orgId: string, now: string, filters: InsightsFilters): Promise<HubInsights & InsightsExtras> {
  const c = await loadCohort(orgId);
  const db = activeDb();
  const [apptRows, invRows] = await Promise.all([
    db.select({ clientId: appointments.clientId, state: appointments.state, startsAt: appointments.startsAt }).from(appointments).where(eq(appointments.orgId, orgId)),
    db.select({ status: invoices.status, issuedAt: invoices.issuedAt, amountCents: invoices.amountCents }).from(invoices).where(eq(invoices.orgId, orgId)),
  ]);
  const appts: ApptRow[] = apptRows.map((a) => ({ clientId: a.clientId, state: a.state, startsAt: a.startsAt.toISOString() }));
  const invs: InvoiceRow[] = invRows.map((i) => ({ status: i.status, issuedAt: i.issuedAt.toISOString(), amountCents: i.amountCents }));
  return computeInsights({ clients: c.clientRows, consentedIds: c.consentedIds, demographics: c.demos, appointments: appts, invoices: invs }, now, filters);
}
