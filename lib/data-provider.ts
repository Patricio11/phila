/**
 * The `dataProvider` seam (DESIGN.md §11 / Mock-First Rule). Every surface reads
 * through this interface. `DATA_PROVIDER=mock` (default in Part A) serves typed
 * fixtures; `DATA_PROVIDER=db` (Part B, Phase 10) serves the real RLS-bounded
 * queries  with **no UI change**. The interface is the contract both sides honour.
 *
 * It grows phase by phase; Phase 0 ships the spine plus exactly what the
 * counsellor dashboard reference build needs.
 */
import type {
  AiRailConfig,
  Appointment,
  CarePlan,
  Client,
  ClientDocument,
  ConsentRecord,
  Counsellor,
  Demographics,
  Document,
  DocumentFolder,
  DocumentRequest,
  Funder,
  Grant,
  GrantIndicator,
  GrantNarrative,
  IntakeForm,
  IntegrationCatalogItem,
  Invoice,
  Org,
  OutcomeMeasure,
  Plan,
  PlatformAuditEvent,
  PlatformOrg,
  Room,
  Service,
  SessionNote,
  Site,
  StorageUsage,
} from "@/lib/domain/types";

/** Everything the booking flow (`/o/[slug]/book`) needs in one fetch. */
export interface BookingConfig {
  org: Org;
  /** Only the publicly-bookable services, per the org's booking settings. */
  services: Service[];
  /** Only the counsellors taking public bookings, per the org's booking settings. */
  counsellors: Counsellor[];
  intakeForm: IntakeForm;
  /** Master switch  false means the org takes bookings by invite only. */
  enabled: boolean;
  /** Earliest a client may book, in hours from now (enforced by the slot engine). */
  minNoticeHours: number;
  /** How far ahead the calendar opens, in days (caps the date picker). */
  maxDaysAhead: number;
  /** How each bookable service may be attended (keyed by service id). */
  serviceModalities: Record<string, { inPerson: boolean; online: boolean }>;
  /** Deposit to confirm a booking (collected when payments go live, Phase 13). */
  deposit: { required: boolean; cents: number };
}

/** Per-service public-booking policy (which services the org lists, and how). */
export interface BookingServicePolicy {
  serviceId: string;
  publiclyBookable: boolean;
  inPerson: boolean;
  online: boolean;
}

/** Per-counsellor public-booking policy (who takes new public bookings). */
export interface BookingCounsellorPolicy {
  counsellorId: string;
  publiclyBookable: boolean;
}

/**
 * How an org runs its public booking. The Hub owns this  each practice differs
 * (some are invite-only; some keep assessments internal; some don't list interns).
 * `getBookingConfig` enforces visibility from here; the slot engine + payments
 * enforce notice / horizon / deposit when they go live (Phase 11 / 13).
 */
export interface BookingSettings {
  orgId: string;
  publicBookingEnabled: boolean;
  /** Earliest a client may book, in hours from now (e.g. 12 = no same-morning). */
  minNoticeHours: number;
  /** How far ahead the calendar opens, in days. */
  maxDaysAhead: number;
  /** Collect the intake form during booking (vs. send it after). */
  requireIntake: boolean;
  requireDeposit: boolean;
  depositCents: number;
  services: BookingServicePolicy[];
  counsellors: BookingCounsellorPolicy[];
}

/** The composed payload for an org's public micro-site (`/o/[slug]`). */
/** Org-managed public micro-site content (Phase 17). One block per section + show/hide. */
export interface PublicPageContent {
  heroHeadline: string | null;
  heroSubtitle: string;
  showOnlineBadge: boolean;
  aboutTitle: string;
  aboutBody: string;
  showAbout: boolean;
  approachTitle: string;
  approachItems: { title: string; body: string }[];
  showApproach: boolean;
  showServices: boolean;
  showTeam: boolean;
  faqItems: { question: string; answer: string }[];
  showFaq: boolean;
  showContact: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  ctaText: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface OrgPublicPage {
  org: Org;
  intro: string;
  about: string;
  sites: Site[];
  offersOnline: boolean;
  services: Service[];
  team: Counsellor[];
  /** Phase 17  the org-managed section content; present in DB mode. */
  content?: PublicPageContent;
}

/** An appointment enriched with the display fields a row needs (names resolved). */
export interface AppointmentView extends Appointment {
  clientName: string;
  serviceName: string;
  counsellorName: string;
  roomName: string | null;
}

export interface OutcomePoint {
  label: string;
  value: number;
}

export interface AttentionItem {
  id: string;
  tone: "rose" | "amber";
  title: string;
  detail: string;
  href?: string;
}

export type CaseloadStatus = "new" | "active" | "at_risk" | "inactive";

export interface CaseloadRow {
  client: Client;
  nextSession: AppointmentView | null;
  lastSession: AppointmentView | null;
  sessionCount: number;
  status: CaseloadStatus;
}

/** The counsellor's view of a client (demographics gated by consent). */
export interface ClientDossier {
  client: Client;
  org: Org;
  counsellor: Counsellor;
  /** Each consent purpose + whether it's currently active. */
  consents: ConsentRecord[];
  /** Present only when the `demographics` consent is active. */
  demographics: Demographics | null;
  sessions: AppointmentView[];
  outcomes: OutcomeMeasure[];
  documents: ClientDocument[];
  carePlan: CarePlan | null;
}

/** Everything the session + note editor needs. */
export interface SessionEditorData {
  appointment: AppointmentView;
  client: Client;
  /** Whether demographics may be shown/extracted (consent-gated). */
  demographicsConsented: boolean;
  /** The private clinical note (may be an unsaved draft). */
  note: SessionNote | null;
  carePlan: CarePlan | null;
  outcomes: OutcomeMeasure[];
  /** "Since last time"  continuity of care across the client's sessions. */
  continuity: {
    sessionNumber: number;
    totalSessions: number;
    previousDate: string | null;
    previousSummary: string | null;
    openGoals: string[];
  };
}

export interface ChatMessage {
  id: string;
  from: "client" | "counsellor";
  text: string;
  at: string;
}
export interface Conversation {
  clientId: string;
  clientName: string;
  unread: number;
  lastAt: string;
  messages: ChatMessage[];
}

export interface ClientProfileView {
  name: string;
  email: string;
  phone: string;
  province: string;
  dateOfBirth: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  preferredContact: string;
  counsellorName: string;
  memberSince: string;
}

export interface TeamMessage {
  id: string;
  from: "me" | "them";
  text: string;
  at: string;
  /** Group threads only: the sender's name (so you know who said what). */
  senderName?: string;
  edited?: boolean;
  deleted?: boolean;
  /** A file attached to the message (opened via a signed URL by message id). */
  attachment?: { name: string; contentType: string; bytes: number };
}

/** An internal staff-to-staff thread (hub ↔ counsellor, counsellor ↔ counsellor). */
export interface TeamThread {
  id: string;
  /** A 1:1 conversation, or a named group. */
  kind: "direct" | "group";
  /** Direct: the other member's id. Group: "" (no single other). */
  otherUserId: string;
  /** Direct: the other member's name. Group: the group title. */
  otherName: string;
  otherRole: import("@/lib/domain/enums").TeamRole;
  /** Group only: how many members. */
  memberCount?: number;
  unread: number;
  lastAt: string;
  messages: TeamMessage[];
}

export interface CounsellorRoomAssignment {
  roomName: string;
  siteName: string;
  colour: string;
  days: number[];
  start: string;
  end: string;
}
export interface CounsellorRoomsView {
  assignments: CounsellorRoomAssignment[];
  bookings: AppointmentView[];
}

export interface SupervisionItem {
  id: string;
  superviseeId: string;
  superviseeName: string;
  clientName: string;
  serviceName: string;
  sessionAt: string;
  submittedAt: string;
  noteExcerpt: string;
  aiGenerated: boolean;
  riskFlagged: boolean;
}

export interface SuperviseeSummary {
  id: string;
  name: string;
  credential: { body: import("@/lib/domain/enums").CredentialBody; status: import("@/lib/domain/enums").CredentialStatus };
  caseload: number;
  pending: number;
}

export interface SupervisionOverview {
  supervisees: SuperviseeSummary[];
  pendingCount: number;
  signedThisMonth: number;
  /** Median-ish hours from submission to sign-off (mock). */
  avgTurnaroundHours: number;
}

/* ---- Org-admin Hub ---------------------------------------------------- */

export interface HubOverview {
  clientsToday: number;
  clientsWeek: number;
  clientsMonth: number;
  newClientsToday: number;
  newClientsWeek: number;
  newClientsMonth: number;
  incomeMonthCents: number;
  incomePredictionCents: number;
  /** Actual (paid) + predicted income for the day and the week. */
  income: {
    todayCents: number;
    weekCents: number;
    predictedTodayCents: number;
    predictedWeekCents: number;
  };
  noShowRate: number;
  openIntakes: number;
  pendingCredentials: number;
  outcomesCoverage: { captured: number; total: number };
  attention: AttentionItem[];
}

export interface OrgClientRow {
  client: Client;
  counsellorName: string;
  nextSession: AppointmentView | null;
  lastSession: AppointmentView | null;
  status: CaseloadStatus;
}

export interface TeamMemberView {
  userId: string;
  name: string;
  email: string;
  teamRole: import("@/lib/domain/enums").TeamRole;
  isSupervisor: boolean;
  active: boolean;
  credential: { body: import("@/lib/domain/enums").CredentialBody; status: import("@/lib/domain/enums").CredentialStatus } | null;
  joinedAt: string;
}

export interface TeamMemberDetail {
  member: TeamMemberView;
  profile: {
    phone: string;
    dateOfBirth: string;
    address: string;
    languages: string[];
    bio: string;
    qualifications: { qualification: string; institution: string; year: number }[];
    specialties: string[];
  } | null;
  registrationNo: string | null;
  counsellorId: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  roomSchedule: { roomName: string; days: number[]; start: string; end: string }[];
  caseload: { id: string; name: string; riskFlag: boolean }[];
  upcoming: AppointmentView[];
  /** Counsellors only; null for non-clinical roles. */
  stats: { caseload: number; sessionsWeek: number; seenWeek: number } | null;
}

export interface RoomView {
  room: Room;
  siteName: string;
  utilisation: { meetings: number; bookedHours: number; utilisationPct: number; busiestDay: string | null };
  assignments: { counsellorName: string; days: number[]; start: string; end: string }[];
  bookings: AppointmentView[];
}

export interface RoomDayOccupancy {
  date: string;
  dow: number;
  openMin: number;
  bookedMin: number;
  freeMin: number;
  pct: number;
  isToday: boolean;
}

export interface RoomDetail {
  room: Room;
  siteName: string;
  businessHours: import("@/lib/domain/types").BusinessHours;
  utilisation: { meetings: number; bookedHours: number; utilisationPct: number; busiestDay: string | null };
  perDay: RoomDayOccupancy[];
  freeHours: number;
  capacityNote: string;
  assignments: { counsellorName: string; days: number[]; start: string; end: string }[];
  bookings: AppointmentView[];
}

export interface IntakeStatusRow {
  client: Client;
  counsellorName: string;
  status: "completed" | "sent" | "not_sent";
  sentAt: string | null;
}

export interface IntakeReviewRow extends IntakeStatusRow {
  submittedAt: string | null;
  /** The client's answers, keyed by form-field id (only when completed). */
  answers: Record<string, string> | null;
}

export interface IntakeBoard {
  form: import("@/lib/domain/types").IntakeForm | null;
  rows: IntakeReviewRow[];
}

export interface DuplicateClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  counsellorName: string;
  sessions: number;
  createdAt: string;
}

export interface DuplicateGroup {
  /** Why these were grouped  matched name / phone / email. */
  reason: string;
  clients: DuplicateClient[];
}

export interface ReportingFilters {
  province?: string;
  gender?: string;
  ageBand?: string;
  employment?: string;
}

export interface Breakdown {
  label: string;
  count: number | null;
  suppressed: boolean;
}

export interface ReportingResult {
  totalClients: number;
  withDemographics: number;
  matched: number;
  byProvince: Breakdown[];
  byGender: Breakdown[];
  byPopulationGroup: Breakdown[];
  byAgeBand: Breakdown[];
  byEmployment: Breakdown[];
  outcome: { points: OutcomePoint[]; coverage: { captured: number; total: number } };
  /** Phase 16  % of clients whose first→latest PHQ-9 dropped ≥5 (≥2 measures). */
  improvementRate?: number;
  /** Phase 16  honest plain-language headline lines for the report. */
  headline?: string[];
}

/** Platform-wide settings the super admin controls (apply to every org). */
export interface PlatformSettings {
  /** National VAT rate as a percentage (e.g. 15). One change, every org updates. */
  vatRatePercent: number;
}

/** An org's invoicing/VAT setup. The rate is global; registration is per-org. */
export interface InvoiceSettings {
  orgId: string;
  vatRegistered: boolean;
  vatNumber: string;
  /** Whether the org's service prices already include VAT. */
  pricesIncludeVat: boolean;
  /** Invoice number prefix, e.g. "MZ" → MZ-2026-0149. */
  invoicePrefix: string;
  /** Days until an invoice is due. */
  paymentTermsDays: number;
  /** Banking details printed on invoices for EFT (blank = omitted). */
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  /** Show a "Pay now" button on sent invoices (needs the org's gateway connected). */
  showPayButton: boolean;
}

export type InsightsPeriod = "week" | "month" | "quarter";

/** Hub-internal analytics filters. Demographic filters narrow the client cohort. */
export interface InsightsFilters {
  period?: InsightsPeriod;
  province?: string;
  gender?: string;
  ageBand?: string;
}

export interface InsightsBar {
  /** Bucket key (date / month). */
  key: string;
  /** Short display label. */
  label: string;
  count: number;
}

export interface InsightsMix {
  label: string;
  count: number;
}

/**
 * Internal management analytics for the Hub  how the practice is actually going.
 * Real counts (the org's own data), NOT k-anonymised: this is the operator's view,
 * distinct from the funder-facing `ReportingResult`. Demographic cuts still honour
 * consent (POPIA); coverage is stated honestly. Audited on read.
 */
export interface HubInsights {
  period: InsightsPeriod;
  /** Session volumes  the at-a-glance "how many sessions" the Hub couldn't see. */
  sessionsToday: number;
  sessionsWeek: number;
  sessionsMonth: number;
  /** Operational metrics for the selected period. */
  completed: number;
  upcoming: number;
  cancelled: number;
  noShows: number;
  attendanceRate: number;
  newClients: number;
  activeClients: number;
  revenueActualCents: number;
  /** Sessions per day across the current week (Mon–Sun). */
  byDay: InsightsBar[];
  /** Sessions per month across the last 6 months. */
  byMonth: InsightsBar[];
  /** Client mix (consented demographics, real counts), filtered by the cohort filters. */
  totalClients: number;
  matchedClients: number;
  withDemographics: number;
  byGender: InsightsMix[];
  byAgeBand: InsightsMix[];
  byProvince: InsightsMix[];
  /** Phase 16  same metrics for the previous comparable window (for trend deltas). */
  previous?: { completed: number; attendanceRate: number; newClients: number; revenueActualCents: number; noShows: number };
}

export interface OrgSettings {
  org: Org;
  paymentProvider: import("@/lib/domain/enums").PaymentProvider | null;
  paymentStatus: "off" | "connected" | "test_passed";
}

/* ---- Funders & grants (M&E) ------------------------------------------ */

export type IndicatorStatus = "on_track" | "at_risk" | "behind";

export interface IndicatorActual {
  indicator: GrantIndicator;
  actual: number;
  /** For count metrics: the target value expected by now, given period pacing. */
  expected: number | null;
  status: IndicatorStatus;
}

export interface GrantBreakdowns {
  byGender: Breakdown[];
  byAgeBand: Breakdown[];
  byProvince: Breakdown[];
}

/** Hub view of a grant (the org sees aggregate figures + can manage). */
export interface GrantView {
  grant: Grant;
  funder: Funder;
  indicators: IndicatorActual[];
  allocatedCount: number;
  withDemographics: number;
  periodElapsedPct: number;
  breakdowns: GrantBreakdowns;
  outcome: { points: OutcomePoint[]; coverage: { captured: number; total: number } };
  narratives: GrantNarrative[];
  /** Phase 16  honest one-line status summary. */
  headline?: string;
}

export interface GrantSummary {
  grant: Grant;
  funder: Funder;
  indicatorCount: number;
  allocatedCount: number;
}

/* ---- Platform (super-admin) ------------------------------------------ */

export interface PlatformOverview {
  orgCount: number;
  activeOrgs: number;
  trialingOrgs: number;
  suspendedOrgs: number;
  totalMembers: number;
  sessions7d: number;
  aiSpendCents: number;
  mrrCents: number;
  integrationHealth: { live: number; mock: number; off: number };
}

export interface PlatformOrgRow {
  org: PlatformOrg;
  planName: string;
  planPriceCents: number;
}

export interface PlanWithUsage {
  plan: Plan;
  subscribers: number;
  mrrCents: number;
}

/**
 * An org's own Phila subscription  what the practice pays *Phila*, billed via the
 * platform's **system gateway** (distinct from the org's BYO gateway, which is for
 * client invoices). This is the org-facing side of platform billing.
 */
export interface OrgSubscription {
  plan: Plan;
  status: "active" | "trialing" | "past_due";
  nextBillingAt: string;
  /** The platform PSP that collects subscription fees. */
  billedVia: string;
}

export interface OnboardingRequirement {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

export type OnboardingDocStatus = "verified" | "pending" | "rejected" | "missing";

export interface OrgOnboardingDoc {
  requirementId: string;
  label: string;
  required: boolean;
  status: OnboardingDocStatus;
  fileName: string | null;
  uploadedAt: string | null;
}

export interface OrgOnboardingReview {
  docs: OrgOnboardingDoc[];
  /** Roll-up: verified (all required verified) · action_needed (a rejected/required-missing) · pending. */
  verification: "verified" | "pending" | "action_needed";
}

export interface PlatformOrgDetail {
  org: PlatformOrg;
  planName: string;
  planPriceCents: number;
  /** The org's people (admins, counsellors, operational roles). */
  team: TeamMemberView[];
  clientCount: number;
  /** Only the seeded org has a full member directory in Part A. */
  fullyModeled: boolean;
}

/** Funder-portal view  read-only, k-anon, no client list, nothing identifiable. */
export interface FunderGrantView {
  grant: Grant;
  funderName: string;
  orgName: string;
  indicators: IndicatorActual[];
  periodElapsedPct: number;
  breakdowns: GrantBreakdowns;
  outcome: { points: OutcomePoint[]; coverage: { captured: number; total: number } };
  narratives: GrantNarrative[];
  /** Phase 16  honest one-line status summary. */
  headline?: string;
}

/** The composed payload for the counsellor's Today dashboard. */
export interface CounsellorDashboard {
  org: Org;
  counsellor: Counsellor;
  today: AppointmentView[];
  stats: {
    clientsToday: number;
    completedToday: number;
    sessionsThisWeek: number;
    /** Honest coverage, not a vanity number. */
    outcomesCoverage: { captured: number; total: number };
    noShowRate: { rate: number; window: string };
  };
  outcomes: { tool: string; points: OutcomePoint[]; coverage: { captured: number; total: number } };
  attention: AttentionItem[];
}

export interface DataProvider {
  // Tenancy
  getOrg(orgId: string): Promise<Org | null>;
  getOrgBySlug(slug: string): Promise<Org | null>;
  /** Public, SEO-facing micro-site payload  no PII, safe to render unauthenticated. */
  getOrgPublicPage(slug: string): Promise<OrgPublicPage | null>;
  listOrgSlugs(): Promise<string[]>;
  /** Booking flow config (service/counsellor/intake) for a public org. */
  getBookingConfig(slug: string): Promise<BookingConfig | null>;
  getBookingSettings(orgId: string): Promise<BookingSettings>;
  getHubInsights(orgId: string, now: string, filters: InsightsFilters): Promise<HubInsights>;
  getPlatformSettings(): Promise<PlatformSettings>;
  getInvoiceSettings(orgId: string): Promise<InvoiceSettings>;
  getOrgSubscription(orgId: string, now: string): Promise<OrgSubscription | null>;

  // People
  getCounsellor(counsellorId: string): Promise<Counsellor | null>;
  listCounsellors(orgId: string): Promise<Counsellor[]>;
  listClients(orgId: string): Promise<Client[]>;
  listServices(orgId: string): Promise<Service[]>;
  listRooms(orgId: string): Promise<Room[]>;

  // Scheduling
  listAppointmentsForCounsellor(
    counsellorId: string,
    opts?: { from?: string; to?: string },
  ): Promise<Appointment[]>;
  listAppointmentsForOrg(
    orgId: string,
    opts?: { from?: string; to?: string },
  ): Promise<Appointment[]>;

  // Composed surfaces
  getCounsellorDashboard(counsellorId: string, now: string): Promise<CounsellorDashboard | null>;

  // Counsellor workspace
  listCaseload(counsellorId: string, now: string): Promise<CaseloadRow[]>;
  getClientDossier(clientId: string, now: string): Promise<ClientDossier | null>;
  listCounsellorSessions(counsellorId: string, now: string): Promise<AppointmentView[]>;
  getSession(appointmentId: string, now: string): Promise<SessionEditorData | null>;
  getSupervisionQueue(supervisorId: string, now: string): Promise<SupervisionItem[]>;
  getSupervisionOverview(supervisorId: string, now: string): Promise<SupervisionOverview>;
  listConversations(counsellorId: string): Promise<Conversation[]>;
  listTeamThreads(userId: string, orgId: string): Promise<TeamThread[]>;
  getCounsellorRooms(counsellorId: string, now: string): Promise<CounsellorRoomsView>;
  listCounsellorInvoices(counsellorId: string): Promise<Invoice[]>;
  /** A counsellor's documents: their own clients' files + anything shared with them  Phase 18. */
  listCounsellorDocuments(counsellorId: string): Promise<{ own: Document[]; shared: Document[] }>;

  // Client portal (a client only ever sees their own data)
  getClient(clientId: string): Promise<Client | null>;
  getClientProfile(clientId: string): Promise<ClientProfileView | null>;
  listAppointmentsForClient(clientId: string, now: string): Promise<AppointmentView[]>;
  getCarePlan(clientId: string): Promise<CarePlan | null>;
  listClientDocuments(clientId: string): Promise<ClientDocument[]>;
  /** Documents shared with the client (assigned + client-visible + clean)  Phase 18. */
  listClientVisibleDocuments(clientId: string): Promise<Document[]>;
  /** The client's open upload requests (uploads are request-bound)  Phase 18. */
  listClientDocumentRequests(clientId: string): Promise<DocumentRequest[]>;
  listClientInvoices(clientId: string): Promise<Invoice[]>;
  getClientConsents(clientId: string): Promise<ConsentRecord[]>;

  // Org-admin Hub
  getHubOverview(orgId: string, now: string): Promise<HubOverview | null>;
  listOrgClients(orgId: string, now: string): Promise<OrgClientRow[]>;
  findDuplicateClients(orgId: string, now: string): Promise<DuplicateGroup[]>;
  listTeam(orgId: string): Promise<TeamMemberView[]>;
  getTeamMemberDetail(orgId: string, userId: string, now: string): Promise<TeamMemberDetail | null>;
  getRoomsOverview(orgId: string, now: string): Promise<RoomView[]>;
  getRoomDetail(roomId: string, now: string): Promise<RoomDetail | null>;
  listSites(orgId: string): Promise<Site[]>;
  listIntakeStatus(orgId: string, now: string): Promise<IntakeStatusRow[]>;
  getIntakeBoard(orgId: string, now: string): Promise<IntakeBoard>;
  getIntakeForm(orgId: string): Promise<import("@/lib/domain/types").IntakeForm | null>;
  listOrgInvoices(orgId: string): Promise<Invoice[]>;
  getReporting(orgId: string, now: string, filters: ReportingFilters): Promise<ReportingResult>;
  getOrgSettings(orgId: string): Promise<OrgSettings | null>;

  // Documents (Phase 18)  the org's document workspace
  listOrgDocuments(orgId: string): Promise<Document[]>;
  listOrgFolders(orgId: string): Promise<DocumentFolder[]>;
  listDocumentRequests(orgId: string): Promise<DocumentRequest[]>;
  getStorageUsage(orgId: string): Promise<StorageUsage>;

  // Funders & grants (M&E)
  listFunders(orgId: string): Promise<Funder[]>;
  listGrants(orgId: string): Promise<GrantSummary[]>;
  getGrantView(grantId: string, now: string): Promise<GrantView | null>;
  /** Funder portal: the grants a funder user is scoped to (read-only). */
  listFunderGrants(funderUserId: string): Promise<{ grant: Grant; funderName: string; orgName: string }[]>;
  getFunderGrantView(funderUserId: string, grantId: string, now: string): Promise<FunderGrantView | null>;

  // Platform (super-admin)
  getPlatformOverview(): Promise<PlatformOverview>;
  listPlatformOrgs(): Promise<PlatformOrgRow[]>;
  getPlatformOrgDetail(orgId: string): Promise<PlatformOrgDetail | null>;
  listOnboardingRequirements(): Promise<OnboardingRequirement[]>;
  getOrgOnboardingReview(orgId: string): Promise<OrgOnboardingReview>;
  listPlans(): Promise<PlanWithUsage[]>;
  getAiRail(): Promise<AiRailConfig>;
  listIntegrations(): Promise<IntegrationCatalogItem[]>;
  listPlatformAudit(): Promise<PlatformAuditEvent[]>;
}

let provider: DataProvider | null = null;

/**
 * The single place the provider is selected. Async import keeps the unused
 * implementation out of the bundle. Part A defaults to mock; `db` is wired in
 * Phase 10 and intentionally throws until then.
 */
export async function getDataProvider(): Promise<DataProvider> {
  if (provider) return provider;
  const kind = process.env.DATA_PROVIDER ?? "mock";
  if (kind === "db") {
    const mod = await import("@/lib/db-provider");
    provider = mod.dbProvider;
  } else {
    const mod = await import("@/lib/mock/provider");
    provider = mod.mockProvider;
  }
  return provider;
}
