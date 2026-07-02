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
  DocumentKind,
  DocumentRequestStatus,
  DocumentSharedBy,
  DocumentVisibility,
  EmploymentStatus,
  FolderScope,
  FormAssignmentStatus,
  FormBgType,
  FormFieldType,
  FormImageFit,
  FormKind,
  FormLayout,
  FormStatus,
  Gender,
  OrgFeature,
  OutcomeTool,
  PopulationGroup,
  Province,
  RoomStatus,
  ScanStatus,
  ShareTargetType,
  StorageBackend,
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
  /**
   * Client-portal onboarding policy. Both default OFF so clients are added/booked
   * silently  many orgs serve clients who won't use a portal. A set-password
   * invite only goes out when the org clicks "Invite to portal", unless the org
   * opts into auto-inviting here.
   */
  clientPortal: {
    /** Auto-invite a client to their portal when they book online. */
    inviteOnBooking: boolean;
    /** Default state of the "Send portal invite" switch on the Add-client modal. */
    inviteOnCreate: boolean;
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
  /** Set on every appointment in a recurring series (enables edit-this/all). */
  seriesId?: string | null;
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

/* ── Document system (Phase 18) ────────────────────────────────────────── */

/** A folder in the org's document tree. Virtual  the tree lives in the DB, so
 * move/assign is a cheap metadata write and is backend-agnostic. */
export interface DocumentFolder {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  scope: FolderScope;
  clientId: string | null;
  createdAt: ISODateTime;
}

/** A document  the generalized `ClientDocument`. Metadata only; the bytes rest
 * in Phila Storage (Supabase) reached via a short-TTL signed URL. */
export interface Document {
  id: string;
  orgId: string;
  folderId: string | null;
  clientId: string | null;
  counsellorId: string | null;
  sessionId: string | null;
  name: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
  storageProvider: StorageBackend;
  storageKey: string | null;
  contentType: string | null;
  bytes: number;
  sizeLabel: string;
  scanStatus: ScanStatus;
  uploadedBy: string | null;
  sharedBy: DocumentSharedBy;
  requestId: string | null;
  createdAt: ISODateTime;
}

/** A document the org asked a client to upload  gates all client uploads. */
export interface DocumentRequest {
  id: string;
  orgId: string;
  clientId: string;
  requestedBy: string;
  title: string;
  note: string | null;
  status: DocumentRequestStatus;
  dueAt: ISODateTime | null;
  fulfilledDocumentId: string | null;
  createdAt: ISODateTime;
}

/** An org → counsellor grant over a file or a whole folder (cascades). */
export interface DocumentShare {
  id: string;
  orgId: string;
  targetType: ShareTargetType;
  targetId: string;
  sharedWith: string;
  grantedBy: string;
  createdAt: ISODateTime;
}

/** An org's storage consumption against its plan entitlement. */
export interface StorageUsage {
  orgId: string;
  bytesUsed: number;
  bytesLimit: number;
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

/** A single question in a form (intake or any other). */
export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** Tags a field as carrying contact PII (drives encryption/redaction later). */
  sensitive?: boolean;
}

/**
 * The look of a form's public/share page (Phase 18.6). Optional  a form with no
 * theme renders the calm default card. `split` adds a branded hero panel beside
 * the form (it stacks above on mobile). All colours are hex strings.
 */
export interface FormTheme {
  layout: FormLayout;
  hero: {
    heading?: string;
    subheading?: string;
    bullets?: string[];
    footNote?: string;
  };
  background: {
    type: FormBgType;
    /** solid */
    color?: string;
    /** gradient */
    gradientFrom?: string;
    gradientTo?: string;
    gradientAngle?: number;
    /** image  storage key in Phila Storage (counts against org storage) */
    imageKey?: string;
    imageFit?: FormImageFit;
    /** overlay tint over the image for legible text */
    overlayColor?: string;
    overlayOpacity?: number; // 0100 (%)
  };
}

/**
 * An org form  a titled set of questions of a given kind (Phase 18.6). The org
 * builds a library of these; the active `kind: "intake"` form drives booking.
 * `fields` is stored as JSONB.
 */
export interface Form {
  id: string;
  orgId: string;
  kind: FormKind;
  title: string;
  intro?: string;
  fields: FormField[];
  status: FormStatus;
  /** Presentation of the public/share page (null = calm default). */
  theme?: FormTheme | null;
  /** The open share link's token (anyone with it can fill), when generated. */
  shareToken?: string | null;
  shareEnabled?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * The form frozen at the moment it was sent to a client. Responses render from
 * this snapshot, so editing the live form never rewrites a past answer.
 */
export interface FormSnapshot {
  kind: FormKind;
  title: string;
  intro?: string;
  fields: FormField[];
}

/** A form sent to a client  and, once filled, their response. */
export interface FormAssignment {
  id: string;
  orgId: string;
  formId: string;
  /** Null for an open share-link submission (no pre-existing client). */
  clientId: string | null;
  /** Captured name for a share-link submission (best-effort from a name field). */
  respondentName?: string | null;
  /** Unguessable capability for the public fill link (`/f/<token>`). */
  token: string;
  status: FormAssignmentStatus;
  snapshot: FormSnapshot;
  /** Keyed by field id; null until submitted. */
  answers: Record<string, string> | null;
  sentBy: string | null;
  sentAt: ISODateTime;
  submittedAt: ISODateTime | null;
}

/**
 * Back-compat aliases  the booking flow + existing intake code predate the
 * forms library. `IntakeField` is a `FormField`; an intake form is a `Form`.
 */
export type IntakeField = FormField;

/** The minimal intake shape the booking flow consumes (a `Form` satisfies it). */
export interface IntakeForm {
  id: string;
  orgId: string;
  title: string;
  intro?: string;
  fields: FormField[];
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
