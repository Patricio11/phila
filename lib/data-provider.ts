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
} from "@/lib/mock/types";

/** Everything the booking flow (`/o/[slug]/book`) needs in one fetch. */
export interface BookingConfig {
  org: Org;
  services: Service[];
  counsellors: Counsellor[];
  intakeForm: IntakeForm;
}

/** The composed payload for an org's public micro-site (`/o/[slug]`). */
export interface OrgPublicPage {
  org: Org;
  intro: string;
  about: string;
  sites: Site[];
  offersOnline: boolean;
  services: Service[];
  team: Counsellor[];
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
  businessHours: import("@/lib/mock/types").BusinessHours;
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
  listConversations(counsellorId: string): Promise<Conversation[]>;
  getCounsellorRooms(counsellorId: string, now: string): Promise<CounsellorRoomsView>;
  listCounsellorInvoices(counsellorId: string): Promise<Invoice[]>;

  // Client portal (a client only ever sees their own data)
  getClient(clientId: string): Promise<Client | null>;
  listAppointmentsForClient(clientId: string, now: string): Promise<AppointmentView[]>;
  getCarePlan(clientId: string): Promise<CarePlan | null>;
  listClientDocuments(clientId: string): Promise<ClientDocument[]>;
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
  listOrgInvoices(orgId: string): Promise<Invoice[]>;
  getReporting(orgId: string, now: string, filters: ReportingFilters): Promise<ReportingResult>;
  getOrgSettings(orgId: string): Promise<OrgSettings | null>;

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
