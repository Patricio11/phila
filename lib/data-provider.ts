/**
 * The `dataProvider` seam (DESIGN.md §11 / Mock-First Rule). Every surface reads
 * through this interface. `DATA_PROVIDER=mock` (default in Part A) serves typed
 * fixtures; `DATA_PROVIDER=db` (Part B, Phase 10) serves the real RLS-bounded
 * queries — with **no UI change**. The interface is the contract both sides honour.
 *
 * It grows phase by phase; Phase 0 ships the spine plus exactly what the
 * counsellor dashboard reference build needs.
 */
import type {
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
  Invoice,
  Org,
  OutcomeMeasure,
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
  incomeMonthCents: number;
  incomePredictionCents: number;
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

export interface RoomView {
  room: Room;
  siteName: string;
  utilisation: { meetings: number; bookedHours: number; utilisationPct: number; busiestDay: string | null };
  assignments: { counsellorName: string; days: number[]; start: string; end: string }[];
  bookings: AppointmentView[];
}

export interface IntakeStatusRow {
  client: Client;
  counsellorName: string;
  status: "completed" | "sent" | "not_sent";
  sentAt: string | null;
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

/** Funder-portal view — read-only, k-anon, no client list, nothing identifiable. */
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
  /** Public, SEO-facing micro-site payload — no PII, safe to render unauthenticated. */
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
  listTeam(orgId: string): Promise<TeamMemberView[]>;
  getRoomsOverview(orgId: string, now: string): Promise<RoomView[]>;
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
