/**
 * Drizzle schema  the **POPIA + tenancy spine** that must exist from commit one
 * (ROADMAP Task 0.2), even while Part A runs on mock data. The full care /
 * scheduling / funder / payments schema lands in Phase 10; this file deliberately
 * starts with tenancy + consent + audit so the compliance seams are never
 * retrofitted.
 *
 * Every tenant-scoped table carries `org_id` and will be bounded by Row-Level
 * Security (the real isolation boundary  docs/SECURITY.md), enforced in Phase 10.
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

export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);
export const consentPurposeEnum = pgEnum("consent_purpose", CONSENT_PURPOSES);
export const consentStateEnum = pgEnum("consent_state", CONSENT_STATES);

/** Tenancy root. */
export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  province: text("province").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const appUsers = pgTable("app_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id),
    teamRole: teamRoleEnum("team_role").notNull(),
    isSupervisor: boolean("is_supervisor").default(false).notNull(),
  },
  (t) => [uniqueIndex("org_members_org_user_uq").on(t.orgId, t.userId)],
);

/** Versioned, purpose-bound consent  the lawful basis for purpose-bound reads. */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    clientId: uuid("client_id").notNull(),
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
  orgId: uuid("org_id"),
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  target: text("target").notNull(),
  reason: text("reason"),
  meta: jsonb("meta"),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});
