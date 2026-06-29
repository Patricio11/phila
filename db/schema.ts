/**
 * Drizzle schema — the **POPIA + tenancy spine** (ROADMAP Task 0.2) plus the
 * Better Auth tables (Phase 9). Identity lives in `user` (db/auth-schema.ts);
 * this file holds tenancy (orgs, org_members), consent, and audit.
 *
 * Ids are **text** and match the mock fixtures (e.g. "org_masizakhe"), so the DB
 * seed mirrors Part A exactly and the hybrid provider's mock fallback returns the
 * same data as a real read. Every tenant-scoped row carries `org_id` and will be
 * bounded by Row-Level Security (the real isolation boundary — docs/SECURITY.md),
 * enforced in Phase 10.
 */
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CONSENT_PURPOSES,
  CONSENT_STATES,
  TEAM_ROLES,
} from "@/lib/domain/enums";
import { user } from "@/db/auth-schema";

export * from "@/db/auth-schema";

export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);
export const consentPurposeEnum = pgEnum("consent_purpose", CONSENT_PURPOSES);
export const consentStateEnum = pgEnum("consent_state", CONSENT_STATES);

/** Tenancy root + the org's display/config (features + scheduling are JSONB). */
export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  province: text("province").notNull(),
  brandAccent: text("brand_accent").default("#1C7D58").notNull(),
  timezone: text("timezone").default("Africa/Johannesburg").notNull(),
  /** Dormant-by-Default feature flags: { ai, video, whatsapp, sms, payments }. */
  features: jsonb("features").$type<Record<string, boolean>>().default({}).notNull(),
  /** { defaultDurationMin, bufferMin, businessHours }. */
  scheduling: jsonb("scheduling").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** Org staff membership — a user's role within an org (a user may belong to many). */
export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    teamRole: teamRoleEnum("team_role").notNull(),
    isSupervisor: boolean("is_supervisor").default(false).notNull(),
  },
  (t) => [uniqueIndex("org_members_org_user_uq").on(t.orgId, t.userId)],
);

/** Versioned, purpose-bound consent — the lawful basis for purpose-bound reads. */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    clientId: text("client_id").notNull(),
    purpose: consentPurposeEnum("purpose").notNull(),
    state: consentStateEnum("state").notNull(),
    version: integer("version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("consents_client_purpose_uq").on(t.clientId, t.purpose)],
);

/** Every PII read/export and privileged action is recorded here (Phase 10). */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id"),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  target: text("target").notNull(),
  reason: text("reason"),
  meta: jsonb("meta"),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});

/* ── Directory cluster (Phase 10): people + resources ──────────────────── */

/** Clinical staff. Credential is flattened for honest querying (never default-verified). */
export const counsellors = pgTable("counsellors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  credentialBody: text("credential_body").notNull(),
  credentialRegNo: text("credential_reg_no"),
  credentialStatus: text("credential_status").notNull(),
  isSupervisor: boolean("is_supervisor").default(false).notNull(),
  supervisorId: text("supervisor_id"),
});

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  /** null = "enquire". */
  priceCents: integer("price_cents"),
});

export const sites = pgTable("sites", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  province: text("province").notNull(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  siteId: text("site_id").notNull().references(() => sites.id),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  equipment: jsonb("equipment").$type<string[]>().default([]).notNull(),
  status: text("status").notNull(),
  colour: text("colour").notNull(),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  province: text("province").notNull(),
  primaryCounsellorId: text("primary_counsellor_id"),
  riskFlag: boolean("risk_flag").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  /** Soft-delete — never distorts compiled stats (Outcome-Honesty). */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** SPECIAL personal information — only present when `demographics` is consented. */
export const demographics = pgTable("demographics", {
  clientId: text("client_id").primaryKey().references(() => clients.id),
  gender: text("gender").notNull(),
  populationGroup: text("population_group").notNull(),
  employmentStatus: text("employment_status").notNull(),
  ageBand: text("age_band").notNull(),
  province: text("province").notNull(),
});
