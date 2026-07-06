/**
 * Drizzle schema  the **POPIA + tenancy spine** (ROADMAP Task 0.2) plus the
 * Better Auth tables (Phase 9). Identity lives in `user` (db/auth-schema.ts);
 * this file holds tenancy (orgs, org_members), consent, and audit.
 *
 * Ids are **text** and match the mock fixtures (e.g. "org_masizakhe"), so the DB
 * seed mirrors Part A exactly and the hybrid provider's mock fallback returns the
 * same data as a real read. Every tenant-scoped row carries `org_id` and will be
 * bounded by Row-Level Security (the real isolation boundary  docs/SECURITY.md),
 * enforced in Phase 10.
 */
import {
  bigint,
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
  /** Client-portal onboarding policy: { inviteOnBooking, inviteOnCreate } (both default off). */
  clientPortal: jsonb("client_portal").$type<Record<string, boolean>>().default({}).notNull(),
  /** Practice profile: { tradingName, registrationNo, practiceNo, email, phone, website, address }. */
  profile: jsonb("profile").$type<Record<string, string>>().default({}).notNull(),
  /** Invoicing config: VAT registration/number, prices-incl-VAT, prefix, terms, banking, pay button. */
  invoiceSettings: jsonb("invoice_settings").$type<Record<string, unknown>>().default({}).notNull(),
  /** Public-booking policy: master switch, notice/horizon, intake/deposit, per-service + per-counsellor overrides. */
  bookingSettings: jsonb("booking_settings").$type<Record<string, unknown>>().default({}).notNull(),
  /** Payment-gateway connection (Dormant-by-Default): { provider, status }. Empty until an admin connects one. */
  payments: jsonb("payments").$type<Record<string, unknown>>().default({}).notNull(),
  /** Verification lifecycle (W1.8): not_started → submitted → verified | action_needed. */
  onboardingStatus: text("onboarding_status").default("not_started").notNull(),
  onboardingSubmittedAt: timestamp("onboarding_submitted_at", { withTimezone: true }),
  onboardingReviewedAt: timestamp("onboarding_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** Platform-wide config (super-admin). Single row (`id = 'global'`); the national VAT rate lives here. */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  vatRatePercent: integer("vat_rate_percent").notNull(),
});

/** The onboarding checklist every new practice must meet (super-admin owns it). */
export const onboardingRequirements = pgTable("onboarding_requirements", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  required: boolean("required").default(true).notNull(),
  sort: integer("sort").default(0).notNull(),
});

/** What each org has submitted against a requirement + the super-admin's decision. */
export const orgOnboardingDocs = pgTable("org_onboarding_docs", {
  orgId: text("org_id").notNull().references(() => orgs.id),
  requirementId: text("requirement_id").notNull(),
  status: text("status").notNull(), // verified | pending | rejected
  fileName: text("file_name"),
  storageKey: text("storage_key"), // the object in Phila Storage (null until uploaded)
  bytes: bigint("bytes", { mode: "number" }).default(0).notNull(),
  reviewNote: text("review_note"), // why a doc was sent back
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
}, (t) => [uniqueIndex("org_onboarding_uq").on(t.orgId, t.requirementId)]);

/** Org staff membership  a user's role within an org (a user may belong to many). */
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
    /** Lifecycle: active | invited (awaiting first sign-in) | archived (access revoked). */
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("org_members_org_user_uq").on(t.orgId, t.userId)],
);

/** Versioned, purpose-bound consent  the lawful basis for purpose-bound reads. */
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
  /** Client self-service profile: { dateOfBirth, address, emergencyName, emergencyPhone, preferredContact }. */
  profile: jsonb("profile").$type<Record<string, string>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  /** Soft-delete  never distorts compiled stats (Outcome-Honesty). */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** SPECIAL personal information  only present when `demographics` is consented. */
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
  rescheduleNote: text("reschedule_note"), // optional reason when a session is moved
  reminded24h: boolean("reminded_24h").default(false).notNull(), // reminder sweep dedup
  reminded1h: boolean("reminded_1h").default(false).notNull(),
});

/* ── Clinical cluster (Phase 10) ───────────────────────────────────────── */

/** The PRIVATE clinical note  author + supervisor only; Hub access audited. */
export const sessionNotes = pgTable("session_notes", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull(),
  authorCounsellorId: text("author_counsellor_id").notNull(),
  body: text("body").notNull(),
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  // Supervision sign-off (W1.1): a supervisor reviews a supervisee's signed note.
  supervisorId: text("supervisor_id"),
  supervisorSignedAt: timestamp("supervisor_signed_at", { withTimezone: true }),
  supervisorDecision: text("supervisor_decision"), // approved | changes_requested
  supervisorComment: text("supervisor_comment"),
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

/** Scopes a funder user to specific grant(s)  read-only. */
export const funderContacts = pgTable("funder_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  funderId: text("funder_id").notNull(),
  grantIds: jsonb("grant_ids").$type<string[]>().default([]).notNull(),
}, (t) => [uniqueIndex("funder_contact_uq").on(t.userId, t.funderId)]);

/* ---- Messaging / notifications (Phase 12) ---------------------------- */

/** In-app notifications (the bell) — one row per recipient user per event. Always-on
 * (no external dependency); email is a separate, complementary channel. */
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  orgId: text("org_id"),
  kind: text("kind").notNull(), // appointment_booked | appointment_cancelled | appointment_moved | …
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [index("notif_user_idx").on(t.userId, t.createdAt)]);

/** The org's public micro-site (Phase 17)  section content + per-section visibility,
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

/** PII-free public-page analytics (Phase 17)  page views + booking-funnel events. No visitor data. */
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
 * Platform integrations (Phase 15)  super-admin-managed platform secrets (e.g.
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
 * Platform AI providers (Phase 14)  super-admin configures OpenAI and/or Claude
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

/** Append-only AI usage ledger (Phase 14)  tokens + cost per call, for metering + the cap. */
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

/** Payments (Phase 15)  a transaction record per purchase (credit packs now; subscriptions/invoices later). */
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

/** An org's OWN payment gateway (Phase 15B)  clients pay the org directly; funds
 * settle to the org, not Phila. Credentials encrypted at rest. One row per org. */
export const orgPaymentConnections = pgTable("org_payment_connections", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  provider: text("provider").notNull(), // paystack (Stitch/Ozow/Yoco later)
  credentialsEnc: text("credentials_enc"),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** An org's Phila subscription (Phase 15A)  what plan they're on + billing state. */
export const subscriptions = pgTable("subscriptions", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  planId: text("plan_id").notNull(),
  status: text("status").default("trialing").notNull(), // trialing | active | past_due | cancelled
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  providerRef: text("provider_ref"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Recipient opt-outs (POPIA)  always win over any send. */
export const messageOptOuts = pgTable("message_opt_outs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  channel: text("channel").notNull(),
  target: text("target").notNull(), // phone or email
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [uniqueIndex("opt_out_uq").on(t.orgId, t.channel, t.target)]);

/* ── Documents cluster (Phase 18) ──────────────────────────────────────── */

/** The org's document folder tree. `parent_id` null = a root folder. Virtual 
 * the tree lives here, so move/assign is a cheap metadata write (backend-agnostic). */
export const documentFolders = pgTable("document_folders", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  scope: text("scope").notNull(), // org | client | counsellor
  clientId: text("client_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("doc_folders_org_idx").on(t.orgId)]);

/** A document  generalizes `client_documents`. Bytes rest in Phila Storage
 * (Supabase), reached via a short-TTL signed URL; this row is metadata only. */
export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  folderId: text("folder_id"),
  clientId: text("client_id"),
  counsellorId: text("counsellor_id"),
  sessionId: text("session_id"),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  visibility: text("visibility").default("internal").notNull(), // client_visible | internal | clinical
  storageProvider: text("storage_provider").default("supabase").notNull(),
  storageKey: text("storage_key"),
  contentType: text("content_type"),
  bytes: bigint("bytes", { mode: "number" }).default(0).notNull(),
  sizeLabel: text("size_label").notNull(),
  scanStatus: text("scan_status").default("pending").notNull(), // pending | clean | quarantined
  uploadedBy: text("uploaded_by"),
  sharedBy: text("shared_by").notNull(), // counsellor | org | client
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("documents_org_idx").on(t.orgId), index("documents_client_idx").on(t.clientId)]);

/** A document the org asked a client to upload  gates ALL client uploads. */
export const documentRequests = pgTable("document_requests", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  clientId: text("client_id").notNull(),
  requestedBy: text("requested_by").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  status: text("status").default("pending").notNull(), // pending | fulfilled | cancelled
  dueAt: timestamp("due_at", { withTimezone: true }),
  fulfilledDocumentId: text("fulfilled_document_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [index("doc_requests_client_idx").on(t.clientId)]);

/** Org → counsellor share of a file or whole folder (folder cascades at read time). */
export const documentShares = pgTable("document_shares", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  targetType: text("target_type").notNull(), // file | folder
  targetId: text("target_id").notNull(),
  sharedWith: text("shared_with").notNull(), // counsellor user id
  grantedBy: text("granted_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [uniqueIndex("doc_share_uq").on(t.targetType, t.targetId, t.sharedWith)]);

/** Per-org storage consumption against the plan entitlement (maintained on upload/delete). */
export const orgStorageUsage = pgTable("org_storage_usage", {
  orgId: text("org_id").primaryKey().references(() => orgs.id),
  bytesUsed: bigint("bytes_used", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/* ── Team messaging cluster (internal staff chat) ─────────────────────── */

/** An internal staff-to-staff conversation  a 1:1 (direct) or a named group. */
export const messageThreads = pgTable("message_threads", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  kind: text("kind").default("direct").notNull(), // direct | group
  title: text("title"), // null for direct (derived from the other member)
  // For direct threads only: `<orgId>:<sorted member ids>`  a unique key that
  // makes "one 1:1 thread per pair" a DB guarantee (no find-then-create race).
  // Null for groups; Postgres treats NULLs as distinct, so many groups coexist.
  pairKey: text("pair_key"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
}, (t) => [index("msg_threads_org_idx").on(t.orgId), uniqueIndex("thread_pair_uq").on(t.pairKey)]);

/** Membership of a thread + each member's read cursor (for unread counts). */
export const threadMembers = pgTable("thread_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  threadId: text("thread_id").notNull(),
  userId: text("user_id").notNull(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
}, (t) => [uniqueIndex("thread_member_uq").on(t.threadId, t.userId)]);

export const teamMessages = pgTable("team_messages", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  threadId: text("thread_id").notNull(),
  senderUserId: text("sender_user_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  attachmentKey: text("attachment_key"),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  attachmentBytes: bigint("attachment_bytes", { mode: "number" }),
}, (t) => [index("team_msgs_thread_idx").on(t.threadId, t.createdAt)]);

/** Last-seen heartbeat for online presence (global per user, not org-scoped). */
export const userPresence = pgTable("user_presence", {
  userId: text("user_id").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
});

/* ── Forms cluster (Phase 18.6  org forms library) ───────────────────── */

/** An org form: a titled set of questions of a given kind. `fields` is JSONB
 *  (`FormField[]`). The active `kind='intake'` form drives public booking. */
export const forms = pgTable("forms", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  kind: text("kind").default("custom").notNull(), // intake | feedback | screening | consent | custom
  title: text("title").notNull(),
  intro: text("intro"),
  fields: jsonb("fields").notNull(), // FormField[]
  status: text("status").default("active").notNull(), // active | archived
  theme: jsonb("theme"), // FormTheme | null  presentation of the public/share page
  shareToken: text("share_token"), // open share link (anyone can fill)
  shareEnabled: boolean("share_enabled").default(false).notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (t) => [index("forms_org_idx").on(t.orgId), uniqueIndex("forms_share_token_uq").on(t.shareToken)]);

/** A form sent to a client  and, once filled, their response. `snapshot` freezes
 *  the form at send time so later edits never rewrite past answers. The `token` is
 *  the unguessable capability behind the public fill link (`/f/<token>`). */
export const formAssignments = pgTable("form_assignments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id),
  formId: text("form_id").notNull(),
  clientId: text("client_id"), // null for open share-link submissions
  respondentName: text("respondent_name"), // captured name for share submissions
  token: text("token").notNull(),
  status: text("status").default("sent").notNull(), // sent | completed | revoked
  snapshot: jsonb("snapshot").notNull(), // { kind, title, intro, fields }
  answers: jsonb("answers"), // Record<fieldId,string> | null until completed
  sentBy: text("sent_by"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("form_assign_token_uq").on(t.token),
  index("form_assign_form_idx").on(t.formId),
  index("form_assign_client_idx").on(t.clientId),
]);
