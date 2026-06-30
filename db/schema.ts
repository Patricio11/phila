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
  index,
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

/** A counsellor's recurring room booking (the schedule the engine defaults from). */
export const roomAssignments = pgTable("room_assignments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  counsellorId: text("counsellor_id").notNull().references(() => counsellors.id),
  roomId: text("room_id").notNull().references(() => rooms.id),
  days: jsonb("days").$type<number[]>().default([]).notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
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

/* ── Scheduling cluster (Phase 11): real appointments ──────────────────── */

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  clientId: text("client_id").notNull(),
  counsellorId: text("counsellor_id").notNull(),
  serviceId: text("service_id").notNull(),
  type: text("type").notNull(),
  roomId: text("room_id"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").notNull(),
  state: text("state").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  seriesId: text("series_id"), // links a recurring series (edit-this/all)
  cancelReason: text("cancel_reason"),
  reminded24h: boolean("reminded_24h").default(false).notNull(), // reminder sweep dedup
  reminded1h: boolean("reminded_1h").default(false).notNull(),
});

/* ── Clinical cluster (Phase 10) ───────────────────────────────────────── */

/** The PRIVATE clinical note — author + supervisor only; Hub access audited. */
export const sessionNotes = pgTable("session_notes", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull(),
  authorCounsellorId: text("author_counsellor_id").notNull(),
  body: text("body").notNull(),
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }),
});

/** The client-SHARED care plan (distinct from the private note). */
export const carePlans = pgTable("care_plans", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  authorCounsellorId: text("author_counsellor_id").notNull(),
  summary: text("summary").notNull(),
  tasks: jsonb("tasks").$type<{ id: string; text: string; done: boolean }[]>().default([]).notNull(),
  resources: jsonb("resources").$type<{ label: string; note?: string }[]>().default([]).notNull(),
  nextStep: text("next_step"),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
});

export const clientDocuments = pgTable("client_documents", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  sizeLabel: text("size_label").notNull(),
  sharedBy: text("shared_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const outcomeMeasures = pgTable("outcome_measures", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  tool: text("tool").notNull(),
  score: integer("score").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
});

/* ── Billing cluster (Phase 10) ────────────────────────────────────────── */

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  number: text("number").notNull(),
  serviceName: text("service_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
});

/* ── Funders & grants cluster (M&E, Phase 10) ──────────────────────────── */

export const funders = pgTable("funders", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
});

export const grants = pgTable("grants", {
  id: text("id").primaryKey(),
  funderId: text("funder_id").notNull(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  title: text("title").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  amountCents: integer("amount_cents").notNull(),
  restricted: boolean("restricted").default(false).notNull(),
  reportingSchedule: text("reporting_schedule").notNull(),
  status: text("status").notNull(),
});

export const grantIndicators = pgTable("grant_indicators", {
  id: text("id").primaryKey(),
  grantId: text("grant_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  metric: text("metric").notNull(),
  target: integer("target").notNull(),
  unit: text("unit").notNull(),
  rule: text("rule").notNull(),
});

export const grantAllocations = pgTable("grant_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  grantId: text("grant_id").notNull(),
  clientId: text("client_id").notNull(),
}, (t) => [uniqueIndex("grant_alloc_uq").on(t.grantId, t.clientId)]);

export const grantNarratives = pgTable("grant_narratives", {
  id: text("id").primaryKey(),
  grantId: text("grant_id").notNull(),
  author: text("author").notNull(),
  body: text("body").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
});

/** Scopes a funder user to specific grant(s) — read-only. */
export const funderContacts = pgTable("funder_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  funderId: text("funder_id").notNull(),
  grantIds: jsonb("grant_ids").$type<string[]>().default([]).notNull(),
}, (t) => [uniqueIndex("funder_contact_uq").on(t.userId, t.funderId)]);

/* ---- Messaging / notifications (Phase 12) ---------------------------- */

/** The org's public micro-site (Phase 17) — section content + per-section visibility,
 * managed by the org. One row per org; rendered SSR at /o/[slug]. */
export const orgPublicPages = pgTable("org_public_pages", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  heroHeadline: text("hero_headline"),
  heroSubtitle: text("hero_subtitle"),
  showOnlineBadge: boolean("show_online_badge").default(true).notNull(),
  aboutTitle: text("about_title").default("About us").notNull(),
  aboutBody: text("about_body"),
  showAbout: boolean("show_about").default(true).notNull(),
  approachTitle: text("approach_title").default("How we work").notNull(),
  approachItems: jsonb("approach_items").$type<{ title: string; body: string }[]>().default([]).notNull(),
  showApproach: boolean("show_approach").default(true).notNull(),
  showServices: boolean("show_services").default(true).notNull(),
  showTeam: boolean("show_team").default(true).notNull(),
  faqItems: jsonb("faq_items").$type<{ question: string; answer: string }[]>().default([]).notNull(),
  showFaq: boolean("show_faq").default(true).notNull(),
  showContact: boolean("show_contact").default(true).notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  ctaText: text("cta_text").default("Book a session").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** PII-free public-page analytics (Phase 17) — page views + booking-funnel events. No visitor data. */
export const publicPageEvents = pgTable("public_page_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  kind: text("kind").notNull(), // view | book_click | booked
  at: timestamp("at", { withTimezone: true }).notNull(),
}, (t) => [index("ppe_org_at_idx").on(t.orgId, t.at)]);

/** Per-org channel enablement + routing/quiet-hours. WhatsApp is BYO; SMS+Email are Phila-provided. */
export const orgMessagingSettings = pgTable("org_messaging_settings", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  whatsappEnabled: boolean("whatsapp_enabled").default(false).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  emailEnabled: boolean("email_enabled").default(false).notNull(),
  emailReplyTo: text("email_reply_to"),
  emailFromName: text("email_from_name"),
  quietStart: text("quiet_start"), // "21:00" SAST; null = none
  quietEnd: text("quiet_end"), // "07:00" SAST
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Org's own WhatsApp Business (Meta Cloud API). Tokens encrypted at rest. */
export const whatsappConnections = pgTable("whatsapp_connections", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  phoneNumberId: text("phone_number_id"),
  wabaId: text("waba_id"),
  accessTokenEnc: text("access_token_enc"),
  appSecretEnc: text("app_secret_enc"),
  verifyToken: text("verify_token"),
  status: text("status").default("off").notNull(), // off | configured | live
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Phila credit balances per metered channel (sms, email). WhatsApp is BYO (org pays Meta). */
export const creditBalances = pgTable("credit_balances", {
  orgId: text("org_id").notNull().references(() => orgs.id),
  channel: text("channel").notNull(), // sms | email
  balance: integer("balance").default(0).notNull(),
}, (t) => [uniqueIndex("credit_balance_uq").on(t.orgId, t.channel)]);

/** Append-only credit movements (purchase / send / refund / grant). Idempotent on idempotency_key. */
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  channel: text("channel").notNull(),
  delta: integer("delta").notNull(), // + purchase, - send
  reason: text("reason").notNull(), // purchase | send | refund | grant
  ref: text("ref"),
  idempotencyKey: text("idempotency_key").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [uniqueIndex("credit_ledger_idem_uq").on(t.idempotencyKey)]);

/** Every send, with an HONEST delivery state (never a fake "sent"). */
export const messageLog = pgTable("message_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  channel: text("channel").notNull(),
  toMasked: text("to_masked").notNull(),
  templateKey: text("template_key").notNull(),
  trigger: text("trigger").notNull(), // booked | rescheduled | cancelled | reminder | no_show
  status: text("status").notNull(), // queued | sent | delivered | failed | blocked | opted_out | no_credit
  detail: text("detail"),
  providerMessageId: text("provider_message_id"),
  costCredits: integer("cost_credits").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/** Message templates. orgId null = Phila system default; an org row overrides. */
export const messageTemplates = pgTable("message_templates", {
  id: text("id").primaryKey(),
  orgId: text("org_id"), // null = system default
  channel: text("channel").notNull(),
  key: text("key").notNull(), // booked | rescheduled | cancelled | reminder | no_show
  body: text("body").notNull(),
  whatsappTemplateName: text("whatsapp_template_name"), // Meta-approved template (used outside the 24h window)
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Per-org AI scribe setting (Phase 14). `aiEnabled` IS the POPIA cross-border consent gate. */
export const orgAiSettings = pgTable("org_ai_settings", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  aiEnabled: boolean("ai_enabled").default(false).notNull(), // off until s.72 cross-border consent acknowledged
  monthlyCapCents: integer("monthly_cap_cents").default(100000).notNull(), // spend ceiling (Cost Rule)
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/**
 * Platform integrations (Phase 15) — super-admin-managed platform secrets (e.g.
 * Phila's own Paystack for credit/subscription billing). Credentials are an
 * encrypted JSON blob. No org_id: platform-only, configured in /admin/integrations.
 */
export const platformIntegrations = pgTable("platform_integrations", {
  key: text("key").primaryKey(), // paystack
  credentialsEnc: text("credentials_enc"),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/**
 * Platform AI providers (Phase 14) — super-admin configures OpenAI and/or Claude
 * (key encrypted, model) and switches one on. The scribe uses the enabled provider.
 * No org_id: this is a platform secret, managed only in /admin.
 */
export const aiProviders = pgTable("ai_providers", {
  provider: text("provider").primaryKey(), // openai | anthropic
  apiKeyEnc: text("api_key_enc"),
  model: text("model"),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Append-only AI usage ledger (Phase 14) — tokens + cost per call, for metering + the cap. */
export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  kind: text("kind").notNull(), // note | care_plan
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  costCents: integer("cost_cents").default(0).notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
});

/** Per-org video setting (Phase 13): in-app LiveKit, or the org's own pasted link. */
export const orgVideoSettings = pgTable("org_video_settings", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  mode: text("mode").default("livekit").notNull(), // livekit | external
  externalUrl: text("external_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Payments (Phase 15) — a transaction record per purchase (credit packs now; subscriptions/invoices later). */
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  provider: text("provider").notNull(), // paystack
  providerRef: text("provider_ref").notNull(),
  purpose: text("purpose").notNull(), // credit_sms | credit_email | invoice | subscription
  packId: text("pack_id"),
  invoiceId: text("invoice_id"),
  creditsAmount: integer("credits_amount").default(0).notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").default("pending").notNull(), // pending | paid | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
}, (t) => [uniqueIndex("payment_ref_uq").on(t.providerRef)]);

/** An org's OWN payment gateway (Phase 15B) — clients pay the org directly; funds
 * settle to the org, not Phila. Credentials encrypted at rest. One row per org. */
export const orgPaymentConnections = pgTable("org_payment_connections", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  provider: text("provider").notNull(), // paystack (Stitch/Ozow/Yoco later)
  credentialsEnc: text("credentials_enc"),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** An org's Phila subscription (Phase 15A) — what plan they're on + billing state. */
export const subscriptions = pgTable("subscriptions", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  planId: text("plan_id").notNull(),
  status: text("status").default("trialing").notNull(), // trialing | active | past_due | cancelled
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  providerRef: text("provider_ref"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Recipient opt-outs (POPIA) — always win over any send. */
export const messageOptOuts = pgTable("message_opt_outs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  channel: text("channel").notNull(),
  target: text("target").notNull(), // phone or email
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [uniqueIndex("opt_out_uq").on(t.orgId, t.channel, t.target)]);
