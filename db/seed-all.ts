/**
 * Seed EVERYTHING from the fixtures into the live DB (Phase 10) — production-real,
 * nothing forgotten. Reads the same `lib/mock/fixtures` the mock provider uses, so
 * the DB mirrors Part A exactly and the hybrid provider's mock fallback == real
 * reads. Idempotent (ON CONFLICT DO NOTHING). Grows cluster-by-cluster.
 *
 *   npm run db:seed        (→ tsx db/seed-all.ts)
 *
 * Every demo account signs in with the password below (see docs/DEMO_LOGINS.md).
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import * as schema from "@/db/schema";
import {
  orgs as orgFx,
  counsellors as counsellorsFx,
  services as servicesFx,
  sites as sitesFx,
  rooms as roomsFx,
  clients as clientsFx,
  demographics as demographicsFx,
  consents as consentsFx,
} from "@/lib/mock/fixtures";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const db = drizzle(neon(url), { schema });

const PASSWORD = "phila1234";
const ORG = "org_masizakhe";

const DEMO_USERS = [
  { id: "user_nomsa", name: "Nomsa Dlamini", email: "nomsa@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_thabo", name: "Thabo Mokoena", email: "thabo@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_aisha", name: "Aisha Patel", email: "aisha@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_pieter", name: "Pieter van der Merwe", email: "pieter@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_thandeka", name: "Thandeka Mbeki", email: "thandeka@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_lerato", name: "Lerato Mahlangu", email: "lerato.m@example.co.za", platformRole: "client", clientId: "cl_lerato" },
  { id: "user_funder", name: "Palesa Mokoena", email: "palesa.mokoena@dsd.example.gov.za", platformRole: "funder", clientId: null },
  { id: "user_operator", name: "Sizwe Ndlovu", email: "ops@philasa.com", platformRole: "super_admin", clientId: null },
];

const MEMBERS = [
  { userId: "user_nomsa", teamRole: "counsellor", isSupervisor: true },
  { userId: "user_thabo", teamRole: "counsellor", isSupervisor: false },
  { userId: "user_aisha", teamRole: "counsellor", isSupervisor: false },
  { userId: "user_pieter", teamRole: "counsellor", isSupervisor: false },
  { userId: "user_thandeka", teamRole: "org_admin", isSupervisor: false },
] as const;

async function main() {
  const hash = await hashPassword(PASSWORD);
  const now = new Date();

  // ── Org (with display + config from the fixture) ──────────────────────
  const org = orgFx[0]!;
  await db.insert(schema.orgs).values({
    id: org.id,
    name: org.name,
    slug: org.slug,
    province: org.province,
    brandAccent: org.brandAccent,
    timezone: org.timezone,
    features: org.features as Record<string, boolean>,
    scheduling: org.scheduling as unknown as Record<string, unknown>,
    createdAt: now,
  }).onConflictDoNothing();

  // ── Identity (users + credentials + memberships) ──────────────────────
  for (const u of DEMO_USERS) {
    await db.insert(schema.user).values({ id: u.id, name: u.name, email: u.email, emailVerified: true, createdAt: now, updatedAt: now, platformRole: u.platformRole, clientId: u.clientId }).onConflictDoNothing();
    await db.insert(schema.account).values({ id: `acct_${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: hash, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }
  for (const m of MEMBERS) {
    await db.insert(schema.orgMembers).values({ orgId: ORG, userId: m.userId, teamRole: m.teamRole, isSupervisor: m.isSupervisor }).onConflictDoNothing();
  }

  // ── Directory cluster ─────────────────────────────────────────────────
  for (const c of counsellorsFx) {
    await db.insert(schema.counsellors).values({
      id: c.id, userId: c.userId, orgId: c.orgId, name: c.name,
      credentialBody: c.credential.body, credentialRegNo: c.credential.registrationNo ?? null, credentialStatus: c.credential.status,
      isSupervisor: c.isSupervisor, supervisorId: c.supervisorId,
    }).onConflictDoNothing();
  }
  for (const s of servicesFx) {
    await db.insert(schema.services).values({ id: s.id, orgId: s.orgId, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }).onConflictDoNothing();
  }
  for (const s of sitesFx) {
    await db.insert(schema.sites).values({ id: s.id, orgId: s.orgId, name: s.name, province: s.province }).onConflictDoNothing();
  }
  for (const r of roomsFx) {
    await db.insert(schema.rooms).values({ id: r.id, orgId: r.orgId, siteId: r.siteId, name: r.name, capacity: r.capacity, equipment: r.equipment, status: r.status, colour: r.colour }).onConflictDoNothing();
  }
  for (const c of clientsFx) {
    await db.insert(schema.clients).values({
      id: c.id, orgId: c.orgId, name: c.name, phone: c.phone ?? null, email: c.email ?? null, province: c.province,
      primaryCounsellorId: c.primaryCounsellorId, riskFlag: c.riskFlag, createdAt: new Date(c.createdAt), deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
    }).onConflictDoNothing();
  }
  for (const d of demographicsFx) {
    await db.insert(schema.demographics).values({ clientId: d.clientId, gender: d.gender, populationGroup: d.populationGroup, employmentStatus: d.employmentStatus, ageBand: d.ageBand, province: d.province }).onConflictDoNothing();
  }

  // ── Consent (versioned, purpose-bound) ────────────────────────────────
  for (const c of consentsFx) {
    await db.insert(schema.consents).values({ orgId: ORG, clientId: c.clientId, purpose: c.purpose, state: c.state, version: c.version, updatedAt: new Date(c.updatedAt) }).onConflictDoNothing();
  }

  const sql = neon(url!);
  const [c] = await sql`select
    (select count(*)::int from orgs) orgs,
    (select count(*)::int from "user") users,
    (select count(*)::int from counsellors) counsellors,
    (select count(*)::int from clients) clients,
    (select count(*)::int from services) services,
    (select count(*)::int from rooms) rooms,
    (select count(*)::int from demographics) demographics,
    (select count(*)::int from consents) consents`;
  console.log("seeded:", c);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
