/**
 * dbProvider  the Part-B (Phase 10) implementation of the `dataProvider` seam,
 * backed by Neon Postgres with Row-Level Security as the real tenant boundary.
 * It is intentionally inert in Part A: selecting `DATA_PROVIDER=db` before
 * Phase 10 fails loudly rather than silently serving nothing.
 */
import type { DataProvider } from "@/lib/data-provider";

function notYet(): never {
  throw new Error(
    "DATA_PROVIDER=db is not implemented until Part B (Phase 10). Run with DATA_PROVIDER=mock.",
  );
}

export const dbProvider: DataProvider = {
  getOrg: notYet,
  getOrgBySlug: notYet,
  getOrgPublicPage: notYet,
  listOrgSlugs: notYet,
  getBookingConfig: notYet,
  getCounsellor: notYet,
  listCounsellors: notYet,
  listClients: notYet,
  listServices: notYet,
  listRooms: notYet,
  listAppointmentsForCounsellor: notYet,
  listAppointmentsForOrg: notYet,
  getCounsellorDashboard: notYet,
  getClient: notYet,
  getClientProfile: notYet,
  listAppointmentsForClient: notYet,
  getCarePlan: notYet,
  listClientDocuments: notYet,
  listClientInvoices: notYet,
  getClientConsents: notYet,
  listCaseload: notYet,
  getClientDossier: notYet,
  listCounsellorSessions: notYet,
  getSession: notYet,
  getSupervisionQueue: notYet,
  getSupervisionOverview: notYet,
  listConversations: notYet,
  listTeamThreads: notYet,
  getCounsellorRooms: notYet,
  listCounsellorInvoices: notYet,
  getHubOverview: notYet,
  listOrgClients: notYet,
  findDuplicateClients: notYet,
  listTeam: notYet,
  getTeamMemberDetail: notYet,
  getRoomsOverview: notYet,
  getRoomDetail: notYet,
  listSites: notYet,
  listIntakeStatus: notYet,
  getIntakeBoard: notYet,
  listOrgInvoices: notYet,
  getReporting: notYet,
  getOrgSettings: notYet,
  listFunders: notYet,
  listGrants: notYet,
  getGrantView: notYet,
  listFunderGrants: notYet,
  getFunderGrantView: notYet,
  getPlatformOverview: notYet,
  listPlatformOrgs: notYet,
  getPlatformOrgDetail: notYet,
  listOnboardingRequirements: notYet,
  getOrgOnboardingReview: notYet,
  listPlans: notYet,
  getAiRail: notYet,
  listIntegrations: notYet,
  listPlatformAudit: notYet,
};
