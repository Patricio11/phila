/**
 * Domain enums  the single source of truth for the value sets used across the
 * product (ROADMAP.md Appendix). These mirror the Part-B Postgres enums exactly,
 * so the mock seam and the real schema never drift. South-African context is
 * baked in (provinces, credential bodies, payment rails).
 */

/** Platform-level identity. `funder` is external, read-only, scoped to grants. */
export const PLATFORM_ROLES = ["super_admin", "client", "funder"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** A user's role *within* an org (a user may belong to several orgs). */
export const TEAM_ROLES = [
  "org_admin",
  "counsellor",
  "front_desk",
  "finance",
  "programme_manager",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  org_admin: "Org admin",
  counsellor: "Counsellor",
  front_desk: "Front desk",
  finance: "Finance",
  programme_manager: "Programme manager",
};

/** Appointment lifecycle (drives the quiet status dot). */
export const APPOINTMENT_STATES = [
  "scheduled",
  "completed",
  "no_show",
  "cancelled",
  "rescheduled",
  "postponed",
  "discharged",
  "risk_flagged",
] as const;
export type AppointmentState = (typeof APPOINTMENT_STATES)[number];

export const APPOINTMENT_TYPES = ["online", "in_person"] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

/** Professional registration bodies relevant in South Africa. */
export const CREDENTIAL_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const CREDENTIAL_BODIES = ["HPCSA", "ASCHP", "SACSSP"] as const;
export type CredentialBody = (typeof CREDENTIAL_BODIES)[number];

export const ROOM_STATUSES = ["active", "maintenance"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

/** Consent purposes  each independently granted/revoked, purpose-bound. */
export const CONSENT_PURPOSES = [
  "booking",
  "notes",
  "demographics",
  "ai_processing",
  "comms",
  "care_plan_share",
  "funder_reporting",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  booking: "Booking & appointments",
  notes: "Clinical notes",
  demographics: "Demographic information",
  ai_processing: "AI-assisted note drafting",
  comms: "Reminders & messages",
  care_plan_share: "Care plan shared with you",
  funder_reporting: "Anonymous funder reporting",
};

export const CONSENT_STATES = ["none", "granted", "revoked"] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

/** Funders & grants (M&E). */
export const FUNDER_TYPES = [
  "government",
  "lottery",
  "corporate_csi",
  "foundation",
  "international",
] as const;
export type FunderType = (typeof FUNDER_TYPES)[number];

export const INDICATOR_TYPES = [
  "count",
  "percentage",
  "outcome_delta",
  "demographic_proportion",
] as const;
export type IndicatorType = (typeof INDICATOR_TYPES)[number];

export const GRANT_STATUSES = ["pending", "active", "closed"] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

/** Payments  SA rails (PayShap / pay-by-bank / cards) + statuses. */
export const PAYMENT_PROVIDERS = ["stitch", "ozow", "yoco", "paystack"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "cancelled",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Outcome measures (extend per org). */
export const OUTCOME_TOOLS = ["PHQ-9", "GAD-7"] as const;
export type OutcomeTool = (typeof OUTCOME_TOOLS)[number];

export const AI_FEATURES = [
  "note_draft",
  "care_plan_draft",
  "extraction",
  "summary",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Per-org feature toggles  dormant by default (Dormant-by-Default Rule). */
export const ORG_FEATURES = ["ai", "video", "whatsapp", "sms", "payments"] as const;
export type OrgFeature = (typeof ORG_FEATURES)[number];

/* ---- South African reference data ------------------------------------- */

export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;
export type Province = (typeof PROVINCES)[number];

export const GENDERS = ["female", "male", "non_binary", "other", "undisclosed"] as const;
export type Gender = (typeof GENDERS)[number];

/** Statistics South Africa population-group categories (statutory reporting). */
export const POPULATION_GROUPS = [
  "black_african",
  "coloured",
  "indian_asian",
  "white",
  "other",
  "undisclosed",
] as const;
export type PopulationGroup = (typeof POPULATION_GROUPS)[number];

export const EMPLOYMENT_STATUSES = [
  "employed",
  "self_employed",
  "unemployed",
  "student",
  "retired",
  "undisclosed",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const AGE_BANDS = ["under_18", "18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Currency is South African Rand throughout. */
export const CURRENCY = "ZAR" as const;
