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

export const REPORTING_SCHEDULES = ["monthly", "quarterly", "biannual", "annual"] as const;

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

/** How a client found the practice (W7 referral/source tracking) — SA-real channels. */
export const REFERRAL_SOURCES = [
  "search",
  "whatsapp",
  "social",
  "sadag",
  "medical",
  "word_of_mouth",
  "funder_programme",
  "school_employer",
  "returning",
  "other",
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, string> = {
  search: "Google / search",
  whatsapp: "WhatsApp",
  social: "Social media",
  sadag: "SADAG",
  medical: "GP / medical referral",
  word_of_mouth: "Word of mouth",
  funder_programme: "Funder programme",
  school_employer: "School / employer",
  returning: "Returning client",
  other: "Other",
};

export const AI_FEATURES = [
  "note_draft",
  "care_plan_draft",
  "extraction",
  "summary",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Per-org feature toggles  dormant by default (Dormant-by-Default Rule). */
export const ORG_FEATURES = ["ai", "video", "whatsapp", "sms", "payments", "funders", "referrals"] as const;
export type OrgFeature = (typeof ORG_FEATURES)[number];

/* ---- Documents (Phase 18) ---------------------------------------------- */

/** What a document is. Drives the icon + the "needs review" grouping. */
export const DOCUMENT_KINDS = [
  "report",
  "resource",
  "upload",
  "form",
  "id",
  "referral",
  "consent",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  report: "Report",
  resource: "Resource",
  upload: "Upload",
  form: "Form",
  id: "ID document",
  referral: "Referral",
  consent: "Consent",
  other: "Document",
};

/** Who may see a document (drives the redaction matrix, §4 of the plan). */
export const DOCUMENT_VISIBILITIES = ["client_visible", "internal", "clinical"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

/** A file is not downloadable until `clean` (virus-scan gate). */
export const SCAN_STATUSES = ["pending", "clean", "quarantined"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** What a folder is anchored to. */
export const FOLDER_SCOPES = ["org", "client", "counsellor"] as const;
export type FolderScope = (typeof FOLDER_SCOPES)[number];

/** A document the org asked a client to upload. */
export const DOCUMENT_REQUEST_STATUSES = ["pending", "fulfilled", "cancelled"] as const;
export type DocumentRequestStatus = (typeof DOCUMENT_REQUEST_STATUSES)[number];

/** Org → counsellor share target. A folder share cascades to its contents. */
export const SHARE_TARGET_TYPES = ["file", "folder"] as const;
export type ShareTargetType = (typeof SHARE_TARGET_TYPES)[number];

/** Phila Storage backends. Supabase now; S3 a later drop-in behind the same seam. */
export const STORAGE_BACKENDS = ["supabase", "s3"] as const;
export type StorageBackend = (typeof STORAGE_BACKENDS)[number];

/** Document who-shared-it provenance. */
export const DOCUMENT_SHARED_BY = ["counsellor", "org", "client"] as const;
export type DocumentSharedBy = (typeof DOCUMENT_SHARED_BY)[number];

/* ---- Forms (org forms library  Phase 18.6) --------------------------- */

/** What a form is for. `intake` is special: the active intake form drives booking. */
export const FORM_KINDS = ["intake", "feedback", "screening", "consent", "custom"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export const FORM_KIND_LABELS: Record<FormKind, string> = {
  intake: "Intake",
  feedback: "Feedback",
  screening: "Screening",
  consent: "Consent",
  custom: "Custom",
};

/** A form is live or tucked away (never hard-deleted  responses must survive). */
export const FORM_STATUSES = ["active", "archived"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

/** The lifecycle of a form sent to a client. */
export const FORM_ASSIGNMENT_STATUSES = ["sent", "completed", "revoked"] as const;
export type FormAssignmentStatus = (typeof FORM_ASSIGNMENT_STATUSES)[number];

/** A question's answer type (shared by the builder, renderer, and validation). */
export const FORM_FIELD_TYPES = ["text", "textarea", "tel", "email", "radio"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** How a form's public/share page is laid out. `split` adds a branded hero panel. */
export const FORM_LAYOUTS = ["form", "split"] as const;
export type FormLayout = (typeof FORM_LAYOUTS)[number];

/** The hero panel's background source. */
export const FORM_BG_TYPES = ["gradient", "solid", "image"] as const;
export type FormBgType = (typeof FORM_BG_TYPES)[number];

/** How an uploaded background image fills the panel. */
export const FORM_IMAGE_FITS = ["cover", "contain"] as const;
export type FormImageFit = (typeof FORM_IMAGE_FITS)[number];

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
