/**
 * Seed the demo org + users into the live DB so real logins map to the same
 * identities Part A used. Idempotent (ON CONFLICT DO NOTHING). Ids match the mock
 * fixtures exactly, so the hybrid provider's mock fallback and real reads agree.
 *
 * Run:  export DATABASE_URL=...;  node db/seed.mjs
 * Every demo account signs in with the password below.
 */
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const sql = neon(url);

const PASSWORD = "phila1234";
const hash = await hashPassword(PASSWORD);
const now = new Date().toISOString();

// Tenancy root.
await sql`INSERT INTO orgs (id, name, slug, province)
  VALUES ('org_masizakhe', 'Masizakhe Counselling', 'masizakhe', 'Gauteng')
  ON CONFLICT (id) DO NOTHING`;

// Org display + config (mirrors the masizakhe fixture). Refreshed on every run.
const features = { ai: false, video: false, whatsapp: false, sms: false, payments: true };
const scheduling = {
  defaultDurationMin: 60,
  bufferMin: 10,
  businessHours: {
    1: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
    2: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
    3: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
    4: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
    5: { start: "08:00", end: "15:00", breaks: [{ start: "12:30", end: "13:00" }] },
    6: null,
    7: null,
  },
};
await sql`UPDATE orgs SET brand_accent = '#1C7D58', timezone = 'Africa/Johannesburg',
  features = ${JSON.stringify(features)}::jsonb, scheduling = ${JSON.stringify(scheduling)}::jsonb
  WHERE id = 'org_masizakhe'`;

// Demo users — ids match the fixtures. platform_role null = org staff.
const users = [
  ["user_nomsa", "Nomsa Dlamini", "nomsa@masizakhe.org.za", null, null],
  ["user_thabo", "Thabo Mokoena", "thabo@masizakhe.org.za", null, null],
  ["user_aisha", "Aisha Patel", "aisha@masizakhe.org.za", null, null],
  ["user_pieter", "Pieter van der Merwe", "pieter@masizakhe.org.za", null, null],
  ["user_thandeka", "Thandeka Mbeki", "thandeka@masizakhe.org.za", null, null],
  ["user_lerato", "Lerato Mahlangu", "lerato.m@example.co.za", "client", "cl_lerato"],
  ["user_funder", "Palesa Mokoena", "palesa.mokoena@dsd.example.gov.za", "funder", null],
  ["user_operator", "Sizwe Ndlovu", "ops@philasa.com", "super_admin", null],
];

for (const [id, name, email, role, clientId] of users) {
  await sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at, platform_role, client_id)
    VALUES (${id}, ${name}, ${email}, true, ${now}, ${now}, ${role}, ${clientId})
    ON CONFLICT (id) DO NOTHING`;
  // Email/password credential — providerId "credential", hashed password.
  await sql`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES (${"acct_" + id}, ${id}, 'credential', ${id}, ${hash}, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING`;
}

// Org staff memberships.
const members = [
  ["org_masizakhe", "user_nomsa", "counsellor", true],
  ["org_masizakhe", "user_thabo", "counsellor", false],
  ["org_masizakhe", "user_aisha", "counsellor", false],
  ["org_masizakhe", "user_pieter", "counsellor", false],
  ["org_masizakhe", "user_thandeka", "org_admin", false],
];

for (const [orgId, userId, role, sup] of members) {
  await sql`INSERT INTO org_members (org_id, user_id, team_role, is_supervisor)
    VALUES (${orgId}, ${userId}, ${role}::team_role, ${sup})
    ON CONFLICT (org_id, user_id) DO NOTHING`;
}

// Consent — versioned, purpose-bound (mirrors the fixtures). All granted, v1.
const consentSets = {
  cl_lerato: ["booking", "notes", "demographics", "comms", "care_plan_share", "funder_reporting"],
  cl_sipho: ["booking", "notes", "comms"],
  cl_fatima: ["booking", "notes", "demographics", "comms", "funder_reporting"],
  cl_johan: ["booking", "notes", "demographics"],
  cl_zanele: ["booking", "notes", "demographics", "comms", "care_plan_share", "funder_reporting"],
  cl_naledi: ["booking", "notes", "demographics", "comms"],
  cl_kabelo: ["booking", "notes"],
  cl_megan: ["booking", "notes", "comms"],
};
for (const [clientId, purposes] of Object.entries(consentSets)) {
  for (const purpose of purposes) {
    await sql`INSERT INTO consents (org_id, client_id, purpose, state, version, updated_at)
      VALUES ('org_masizakhe', ${clientId}, ${purpose}::consent_purpose, 'granted'::consent_state, 1, ${now})
      ON CONFLICT (client_id, purpose) DO NOTHING`;
  }
}

const counts = await sql`SELECT
  (SELECT count(*) FROM orgs) AS orgs,
  (SELECT count(*) FROM "user") AS users,
  (SELECT count(*) FROM account) AS accounts,
  (SELECT count(*) FROM org_members) AS members,
  (SELECT count(*) FROM consents) AS consents`;
console.log("seeded:", counts[0]);
