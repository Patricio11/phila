import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeDb } from "@/lib/db/scoped";
import { funders, grants, grantIndicators, grantAllocations, grantNarratives, funderContacts, orgs, appointments } from "@/db/schema";
import { user } from "@/db/auth-schema";
import type { Funder, Grant, GrantIndicator, GrantNarrative } from "@/lib/domain/types";
import type { GrantSummary, GrantView, FunderGrantView, IndicatorActual } from "@/lib/data-provider";
import { loadCohort } from "@/db/queries/analytics";
import { computeIndicator, grantBreakdowns, outcomeTrend, grantHeadline, periodElapsed, type ApptRow } from "@/lib/domain/reporting";

/** Phase 16  funder / M&E reads from real grant tables + clinical data (no mock). */

const toFunder = (f: typeof funders.$inferSelect): Funder => ({ id: f.id, orgId: f.orgId, name: f.name, type: f.type as Funder["type"], contactName: f.contactName, contactEmail: f.contactEmail });
const toGrant = (g: typeof grants.$inferSelect): Grant => ({ id: g.id, funderId: g.funderId, orgId: g.orgId, title: g.title, periodStart: g.periodStart, periodEnd: g.periodEnd, amountCents: g.amountCents, restricted: g.restricted, reportingSchedule: g.reportingSchedule as Grant["reportingSchedule"], status: g.status as Grant["status"] });
const toIndicator = (i: typeof grantIndicators.$inferSelect): GrantIndicator => ({ id: i.id, grantId: i.grantId, name: i.name, type: i.type as GrantIndicator["type"], metric: i.metric as GrantIndicator["metric"], target: i.target, unit: i.unit, rule: i.rule });

export async function listFundersDb(orgId: string): Promise<Funder[]> {
  return (await activeDb().select().from(funders).where(eq(funders.orgId, orgId))).map(toFunder);
}

export async function listGrantsDb(orgId: string): Promise<GrantSummary[]> {
  const db = activeDb();
  const [gRows, fRows, indRows, allocRows] = await Promise.all([
    db.select().from(grants).where(eq(grants.orgId, orgId)),
    db.select().from(funders).where(eq(funders.orgId, orgId)),
    db.select({ grantId: grantIndicators.grantId }).from(grantIndicators),
    db.select({ grantId: grantAllocations.grantId, clientId: grantAllocations.clientId }).from(grantAllocations),
  ]);
  const funderById = new Map(fRows.map((f) => [f.id, toFunder(f)]));
  return gRows.map((g) => ({
    grant: toGrant(g),
    funder: funderById.get(g.funderId)!,
    indicatorCount: indRows.filter((i) => i.grantId === g.id).length,
    allocatedCount: new Set(allocRows.filter((a) => a.grantId === g.id).map((a) => a.clientId)).size,
  })).filter((s) => s.funder);
}

/** Shared compute for a single grant: indicators, breakdowns, outcome, narratives. */
async function computeGrant(grant: Grant, now: string) {
  const db = activeDb();
  const [allocRows, indRows, narrRows, cohort, apptRows] = await Promise.all([
    db.select({ clientId: grantAllocations.clientId }).from(grantAllocations).where(eq(grantAllocations.grantId, grant.id)),
    db.select().from(grantIndicators).where(eq(grantIndicators.grantId, grant.id)),
    db.select().from(grantNarratives).where(eq(grantNarratives.grantId, grant.id)).orderBy(desc(grantNarratives.postedAt)),
    loadCohort(grant.orgId),
    db.select({ clientId: appointments.clientId, state: appointments.state, startsAt: appointments.startsAt }).from(appointments).where(eq(appointments.orgId, grant.orgId)),
  ]);
  const orgClientIds = new Set(cohort.clientRows.map((c) => c.id));
  const allocatedIds = [...new Set(allocRows.map((a) => a.clientId))].filter((id) => orgClientIds.has(id));
  const appts: ApptRow[] = apptRows.map((a) => ({ clientId: a.clientId, state: a.state, startsAt: a.startsAt.toISOString() }));

  const indicators: IndicatorActual[] = indRows.map(toIndicator).map((ind) => computeIndicator(ind, grant, { allocatedIds, consentedIds: cohort.consentedIds, demographics: cohort.demos, outcomes: cohort.outcomes, appointments: appts }, now));
  const breakdowns = grantBreakdowns(cohort.consentedIds, allocatedIds, cohort.demos);

  const consentedAllocated = new Set(allocatedIds.filter((id) => cohort.consentedIds.has(id)));
  const outcome = outcomeTrend(cohort.outcomes, consentedAllocated, now);
  const measured = new Set(cohort.outcomes.filter((o) => o.tool === "PHQ-9" && allocatedIds.includes(o.clientId)).map((o) => o.clientId)).size;
  outcome.coverage = { captured: measured, total: allocatedIds.length };

  const periodElapsedPct = Math.round(periodElapsed(grant, now) * 100);
  const narratives: GrantNarrative[] = narrRows.map((n) => ({ id: n.id, grantId: n.grantId, author: n.author, body: n.body, postedAt: n.postedAt.toISOString() }));
  return {
    indicators, breakdowns, outcome, periodElapsedPct, narratives,
    allocatedCount: allocatedIds.length,
    withDemographics: consentedAllocated.size,
    headline: grantHeadline(indicators, periodElapsedPct),
  };
}

export async function getGrantViewDb(grantId: string, now: string): Promise<(GrantView & { headline: string }) | null> {
  const db = activeDb();
  const [g] = await db.select().from(grants).where(eq(grants.id, grantId)).limit(1);
  if (!g) return null;
  const [f] = await db.select().from(funders).where(eq(funders.id, g.funderId)).limit(1);
  if (!f) return null;
  const grant = toGrant(g);
  const c = await computeGrant(grant, now);
  return { grant, funder: toFunder(f), allocatedCount: c.allocatedCount, withDemographics: c.withDemographics, periodElapsedPct: c.periodElapsedPct, indicators: c.indicators, breakdowns: c.breakdowns, outcome: c.outcome, narratives: c.narratives, headline: c.headline };
}

export async function listFunderGrantsDb(funderUserId: string): Promise<{ grant: Grant; funderName: string; orgName: string }[]> {
  const db = getDb();
  const contacts = await db.select().from(funderContacts).where(eq(funderContacts.userId, funderUserId));
  const grantIds = new Set(contacts.flatMap((c) => c.grantIds));
  if (grantIds.size === 0) return [];
  const [gRows, fRows, oRows] = await Promise.all([
    db.select().from(grants),
    db.select().from(funders),
    db.select({ id: orgs.id, name: orgs.name }).from(orgs),
  ]);
  const funderName = new Map(fRows.map((f) => [f.id, f.name]));
  const orgName = new Map(oRows.map((o) => [o.id, o.name]));
  return gRows.filter((g) => grantIds.has(g.id)).map((g) => ({ grant: toGrant(g), funderName: funderName.get(g.funderId) ?? "", orgName: orgName.get(g.orgId) ?? "" }));
}

export async function getFunderGrantViewDb(funderUserId: string, grantId: string, now: string): Promise<(FunderGrantView & { headline: string }) | null> {
  const db = getDb();
  // Scope: a funder reaches ONLY their grant(s).
  const contacts = await db.select().from(funderContacts).where(eq(funderContacts.userId, funderUserId));
  const scoped = contacts.some((c) => c.grantIds.includes(grantId));
  if (!scoped) return null;
  const [g] = await db.select().from(grants).where(eq(grants.id, grantId)).limit(1);
  if (!g) return null;
  const [f] = await db.select().from(funders).where(eq(funders.id, g.funderId)).limit(1);
  const [o] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, g.orgId)).limit(1);
  const grant = toGrant(g);
  const c = await computeGrant(grant, now);
  return { grant, funderName: f?.name ?? "", orgName: o?.name ?? "", periodElapsedPct: c.periodElapsedPct, indicators: c.indicators, breakdowns: c.breakdowns, outcome: c.outcome, narratives: c.narratives, headline: c.headline };
}

/** The org that owns a grant  for an ownership check before a write. */
export async function getGrantOrgId(grantId: string): Promise<string | null> {
  const [g] = await getDb().select({ orgId: grants.orgId }).from(grants).where(eq(grants.id, grantId)).limit(1);
  return g?.orgId ?? null;
}

/** Post a grant narrative (Phase 16)  persists; org-side authorship checked by the caller. */
export async function postGrantNarrativeDb(grantId: string, author: string, body: string): Promise<void> {
  await getDb().insert(grantNarratives).values({ id: `narr_${crypto.randomUUID().slice(0, 12)}`, grantId, author, body, postedAt: new Date() });
}

/* ── Writes (Phase 18.8)  org builds its own funders, grants, indicators + allocations.
      Every write is org-scoped; grant-child writes verify grant ownership via the caller. ── */

const rid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

export interface FunderInput { name: string; type: string; contactName: string; contactEmail: string }
export interface GrantInput { funderId: string; title: string; periodStart: string; periodEnd: string; amountCents: number; restricted: boolean; reportingSchedule: string; status: string }
export interface IndicatorInput { name: string; type: string; metric: string; target: number; unit: string; rule: string }

export async function createFunderDb(orgId: string, input: FunderInput): Promise<{ id: string }> {
  const id = rid("f");
  await getDb().insert(funders).values({ id, orgId, name: input.name, type: input.type, contactName: input.contactName, contactEmail: input.contactEmail });
  return { id };
}

export async function updateFunderDb(orgId: string, funderId: string, input: FunderInput): Promise<void> {
  await getDb().update(funders).set({ name: input.name, type: input.type, contactName: input.contactName, contactEmail: input.contactEmail }).where(and(eq(funders.id, funderId), eq(funders.orgId, orgId)));
}

/** Remove a funder and cascade its grants (+ indicators/allocations/narratives). */
export async function deleteFunderDb(orgId: string, funderId: string): Promise<void> {
  const db = getDb();
  const gs = await db.select({ id: grants.id }).from(grants).where(and(eq(grants.funderId, funderId), eq(grants.orgId, orgId)));
  const gids = gs.map((g) => g.id);
  if (gids.length) {
    await db.delete(grantAllocations).where(inArray(grantAllocations.grantId, gids));
    await db.delete(grantIndicators).where(inArray(grantIndicators.grantId, gids));
    await db.delete(grantNarratives).where(inArray(grantNarratives.grantId, gids));
    await db.delete(grants).where(inArray(grants.id, gids));
  }
  await db.delete(funders).where(and(eq(funders.id, funderId), eq(funders.orgId, orgId)));
}

export async function createGrantDb(orgId: string, input: GrantInput): Promise<{ id: string }> {
  const id = rid("g");
  await getDb().insert(grants).values({ id, orgId, funderId: input.funderId, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, amountCents: input.amountCents, restricted: input.restricted, reportingSchedule: input.reportingSchedule, status: input.status });
  return { id };
}

export async function updateGrantDb(orgId: string, grantId: string, input: GrantInput): Promise<void> {
  await getDb().update(grants).set({ funderId: input.funderId, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, amountCents: input.amountCents, restricted: input.restricted, reportingSchedule: input.reportingSchedule, status: input.status }).where(and(eq(grants.id, grantId), eq(grants.orgId, orgId)));
}

export async function deleteGrantDb(orgId: string, grantId: string): Promise<void> {
  const db = getDb();
  const owns = (await db.select({ id: grants.id }).from(grants).where(and(eq(grants.id, grantId), eq(grants.orgId, orgId))).limit(1)).length > 0;
  if (!owns) return;
  await db.delete(grantAllocations).where(eq(grantAllocations.grantId, grantId));
  await db.delete(grantIndicators).where(eq(grantIndicators.grantId, grantId));
  await db.delete(grantNarratives).where(eq(grantNarratives.grantId, grantId));
  await db.delete(grants).where(eq(grants.id, grantId));
}

/** Replace a grant's indicators wholesale (the edit form owns the whole set). */
export async function setGrantIndicatorsDb(grantId: string, indicators: IndicatorInput[]): Promise<void> {
  const db = getDb();
  await db.delete(grantIndicators).where(eq(grantIndicators.grantId, grantId));
  if (indicators.length) {
    await db.insert(grantIndicators).values(indicators.map((i) => ({ id: rid("ind"), grantId, name: i.name, type: i.type, metric: i.metric, target: i.target, unit: i.unit, rule: i.rule })));
  }
}

/** Replace the clients tagged to a grant (which clients count toward its targets). */
export async function setGrantAllocationsDb(grantId: string, clientIds: string[]): Promise<void> {
  const db = getDb();
  await db.delete(grantAllocations).where(eq(grantAllocations.grantId, grantId));
  const unique = [...new Set(clientIds)];
  if (unique.length) {
    await db.insert(grantAllocations).values(unique.map((clientId) => ({ grantId, clientId })));
  }
}

/**
 * Invite (or re-scope) a funder to one or more grants. Provisions a funder user
 * account keyed by email if one doesn't exist yet (they set a password via the
 * activation link), then upserts the funderContact scope. The funder portal reads
 * ONLY the grant(s) in this scope (Rule #10).
 */
export async function inviteFunderContactDb(funderId: string, grantIds: string[], email: string, name: string): Promise<{ userId: string; existing: boolean }> {
  const db = getDb();
  const [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  let userId = found?.id;
  if (!userId) {
    userId = rid("funder");
    await db.insert(user).values({ id: userId, name: name || email, email, emailVerified: false, platformRole: "funder", createdAt: new Date(), updatedAt: new Date() });
  }
  await db
    .insert(funderContacts)
    .values({ userId, funderId, grantIds })
    .onConflictDoUpdate({ target: [funderContacts.userId, funderContacts.funderId], set: { grantIds } });
  return { userId, existing: Boolean(found) };
}

/** The grant's indicators + tagged client ids  for the edit surfaces. */
export async function getGrantAdminDb(orgId: string, grantId: string): Promise<{ indicators: GrantIndicator[]; allocatedClientIds: string[] } | null> {
  const db = getDb();
  const [g] = await db.select({ id: grants.id }).from(grants).where(and(eq(grants.id, grantId), eq(grants.orgId, orgId))).limit(1);
  if (!g) return null;
  const [indRows, allocRows] = await Promise.all([
    db.select().from(grantIndicators).where(eq(grantIndicators.grantId, grantId)),
    db.select({ clientId: grantAllocations.clientId }).from(grantAllocations).where(eq(grantAllocations.grantId, grantId)),
  ]);
  return { indicators: indRows.map(toIndicator), allocatedClientIds: allocRows.map((a) => a.clientId) };
}
