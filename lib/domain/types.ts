/**
 * Mock domain types  mirror the Part-B Postgres schema (ROADMAP.md Phase 10 /
 * Appendix) so flipping `DATA_PROVIDER=mock|db` swaps implementations with no UI
 * change. Types are redaction- and consent-aware by construction: the private
 * clinical note (`SessionNote`) is a different type from the client-shared
 * artifact (`CarePlan`), and demographics are an optional, consent-gated record.
 *
 * Phase 0 models the spine + the entities the counsellor dashboard needs. Later
 * phases extend this file (intake, invoicing, grants, payments) without changing
 * the seam's shape.
 */
import type {
  AgeBand,
  AppointmentState,
  AppointmentType,
  ConsentPurpose,
  ConsentState,
  CredentialBody,
  CredentialStatus,
  EmploymentStatus,
  Gender,
  OrgFeature,
  OutcomeTool,
  PopulationGroup,
  Province,
  RoomStatus,
  TeamRole,
} from "@/lib/domain/enums";

/** ISO-8601 instant (UTC). SA operates in a single timezone (SAST, UTC+2). */
export type ISODateTime = string;
export type ISODate = string; // YYYY-MM-DD

export interface Org {
  id: string;
  name: string;
  slug: string;
  /** A single brand accent for the org's public page only (DESIGN.md §9). */
  brandAccent: string;
  province: Province;
  timezone: "Africa/Johannesburg";
  /** Dormant-by-Default: every paid/variable feature is off until configured. */
  features: Record<OrgFeature, boolean>;
  /** Scheduling defaults used by the slot engine. */
  scheduling: {
    defaultDurationMin: number;
    bufferMin: number;
    businessHours: BusinessHours;
  };
}

/** Per-weekday business hours; `null` means closed that day. Monday = 1. */
export type BusinessHours = Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7,
  { start: string; end: string; breaks?: { start: string; end: string }[] } | null
>;

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string; // +27…
  twoFactorEnabled: boolean;
}

export interface OrgMembership {
  userId: string;
  orgId: string;
  teamRole: TeamRole;
  isSupervisor: boolean;
}

export interface Counsellor {
  id: string;
  userId: string;
  orgId: string;
  name: string;
  /** HPCSA / ASCHP / SACSSP registration  honest, never default-verified. */
  credential: {
    body: CredentialBody;
    registrationNo?: string;
    status: CredentialStatus;
  };
  isSupervisor: boolean;
  supervisorId: string | null;
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  durationMin: number;
  /** Price in cents (ZAR); null means "enquire". */
  priceCents: number | null;
}

export interface Site {
  id: string;
  orgId: string;
  name: string;
  province: Province;
}

export interface Room {
  id: string;
  orgId: string;
  siteId: string;
  name: string;
  capacity: number;
  equipment: string[];
  status: RoomStatus;
  /** Colour for the calendar lane. */
  colour: string;
}

export interface Client {
  id: string;
  orgId: string;
  name: string;
  phone?: string;
  email?: string;
  province: Province;
  primaryCounsellorId: string | null;
  /** First-class but never auto-actioned (Safeguarding Rule). */
  riskFlag: boolean;
  createdAt: ISODateTime;
  /** Soft-delete  deletion never distorts compiled stats (Outcome-Honesty). */
  deletedAt: ISODateTime | null;
}

/** SPECIAL personal information  only present when `demographics` is consented. */
export interface Demographics {
  clientId: string;
  gender: Gender;
  populationGroup: PopulationGroup;
  employmentStatus: EmploymentStatus;
  ageBand: AgeBand;
  province: Province;
}

export interface Appointment {
  id: string;
  orgId: string;
  clientId: string;
  counsellorId: string;
  serviceId: string;
  type: AppointmentType;
  roomId: string | null; // required for in_person (Phase 11)
  startsAt: ISODateTime;
  durationMin: number;
  state: AppointmentState;
  tags?: string[];
}

/** The **private** clinical note  author + supervisor only; Hub access audited. */
export interface SessionNote {
  id: string;
  appointmentId: string;
  authorCounsellorId: string;
  body: string;
  aiGenerated: boolean;
  signedAt: ISODateTime | null;
}

/** The **client-shared** artifact  explicitly, consentedly shared; not the note. */
export interface CarePlan {
  id: string;
  clientId: string;
  authorCounsellorId: string;
  summary: string;
  tasks: { id: string; text: string; done: boolean }[];
  resources: { label: string; note?: string }[];
  nextStep: string | null;
  sharedAt: ISODateTime | null;
}

/** A document on the client's record (mock uploads / shared resources / reports). */
export interface ClientDocument {
  id: string;
  clientId: string;
  orgId: string;
  name: string;
  kind: "report" | "resource" | "upload" | "form";
  sizeLabel: string;
  sharedBy: "counsellor" | "org" | "client";
  createdAt: ISODateTime;
}

/** A client invoice (mock; PayShap settlement in Phase 15). */
export interface Invoice {
  id: string;
  clientId: string;
  orgId: string;
  number: string;
  serviceName: string;
  amountCents: number;
  status: import("@/lib/domain/enums").PaymentStatus;
  issuedAt: ISODateTime;
  dueAt: ISODateTime;
}

export interface OutcomeMeasure {
  id: string;
  clientId: string;
  tool: OutcomeTool;
  score: number;
  takenAt: ISODateTime;
}

/** An org's intake form  rendered during booking, captured with consent. */
export interface IntakeField {
  id: string;
  label: string;
  type: "text" | "textarea" | "tel" | "email" | "radio";
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** Tags a field as carrying contact PII (drives encryption/redaction later). */
  sensitive?: boolean;
}

export interface IntakeForm {
  id: string;
  orgId: string;
  title: string;
  intro?: string;
  fields: IntakeField[];
}

/* ---- Funders & grants (M&E) ------------------------------------------ */

export interface Funder {
  id: string;
  orgId: string;
  name: string;
  type: import("@/lib/domain/enums").FunderType;
  contactName: string;
  contactEmail: string;
}

export type ReportingSchedule = "monthly" | "quarterly" | "biannual" | "annual";

export interface Grant {
  id: string;
  funderId: string;
  orgId: string;
  title: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  amountCents: number;
  restricted: boolean;
  reportingSchedule: ReportingSchedule;
  status: import("@/lib/domain/enums").GrantStatus;
}

/**
 * An indicator's `metric` is the computation key the engine knows how to derive
 * from the clinical work  the actual is never typed by hand (the logframe).
 */
export type IndicatorMetric =
  | "unique_clients"
  | "sessions_delivered"
  | "pct_female"
  | "pct_employed"
  | "pct_youth"
  | "phq9_improved_5";

export interface GrantIndicator {
  id: string;
  grantId: string;
  name: string;
  type: import("@/lib/domain/enums").IndicatorType;
  metric: IndicatorMetric;
  target: number;
  unit: string; // "clients", "%", "sessions"
  rule: string; // human-readable computation rule
}

/** Clients tagged as served under a grant (a client may map to several). */
export interface GrantAllocation {
  grantId: string;
  clientId: string;
}

export interface GrantNarrative {
  id: string;
  grantId: string;
  author: string;
  body: string;
  postedAt: ISODateTime;
}

/** Scopes a funder user to specific grant(s)  read-only (Phase 9 real flow). */
export interface FunderContact {
  userId: string;
  funderId: string;
  grantIds: string[];
}

/* ---- Platform (super-admin) ------------------------------------------ */

/** A subscription plan tier, sourced from the plans table (no entitlement drift). */
export interface Plan {
  id: string;
  name: string;
  tagline: string;
  /** Monthly price in cents (ZAR). 0 = free. */
  priceCents: number;
  /** null = unlimited. */
  seats: number | null;
  aiTokens: number; // monthly AI token allowance
  videoMinutes: number;
  messaging: boolean; // WhatsApp + SMS
  rooms: number | null;
  popular?: boolean;
  ngo?: boolean;
}

export interface PlatformOrg {
  id: string;
  name: string;
  province: Province;
  planId: string;
  subscriptionStatus: import("@/lib/domain/enums").SubscriptionStatus;
  members: number;
  sessions7d: number;
  aiSpendCents: number;
  createdAt: ISODate;
  suspended: boolean;
}

export interface AiRailConfig {
  provider: "openai" | "anthropic" | "bedrock";
  model: string;
  maxTokens: number;
  status: "off" | "mock" | "live";
  s72Acknowledged: boolean;
  monthlySpendCents: number;
  defaultOrgCapCents: number;
}

export interface IntegrationCatalogItem {
  key: string;
  name: string;
  category: "messaging" | "video" | "payments" | "platform";
  status: "off" | "mock" | "live";
  description: string;
}

export interface PlatformAuditEvent {
  id: string;
  at: ISODateTime;
  action: string;
  actor: string;
  orgName: string | null;
  target: string;
  reason: string | null;
}

/** Versioned, purpose-bound consent (Consent-Before-Capture Rule). */
export interface ConsentRecord {
  clientId: string;
  purpose: ConsentPurpose;
  state: ConsentState;
  version: number;
  updatedAt: ISODateTime;
}
