/**
 * Better Auth core tables (Phase 9). These match Better Auth's expected schema
 * exactly; the JS keys are the field names its Drizzle adapter binds to. Phila's
 * own identity rides along as two extra `user` columns (platform_role, client_id);
 * org membership lives in `org_members` (db/schema.ts). Ids are text so the demo
 * seed can use the same ids as the mock fixtures (seamless mock↔db fallback).
 */
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").$defaultFn(() => false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
  /** TOTP 2FA enrolled (Better Auth twoFactor plugin). */
  twoFactorEnabled: boolean("two_factor_enabled").$defaultFn(() => false),
  /** Phila: platform role (client | funder | super_admin); null for org staff. */
  platformRole: text("platform_role"),
  /** Phila: for a client user, their linked client record id. */
  clientId: text("client_id"),
});

/** TOTP secret + backup codes per user (Better Auth twoFactor plugin). */
export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").$defaultFn(() => true),
  failedVerificationCount: integer("failed_verification_count").$defaultFn(() => 0),
  lockedUntil: timestamp("locked_until"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});
