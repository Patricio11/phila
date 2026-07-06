/**
 * mockProvider  the Part-A implementation of the `dataProvider` seam. It reads
 * typed fixtures and materialises a live week of appointments around "now", so
 * the demo is always populated and behaves like production. It is consent- and
 * redaction-aware: it never returns demographics without an active consent, and
 * the private note is a different path from the shared care plan.
 */
import type {
  AppointmentView,
  AttentionItem,
  BookingSettings,
  Breakdown,
  CaseloadRow,
  CaseloadStatus,
  ClientProfileView,
  Conversation,
  CounsellorDashboard,
  CounsellorRoomsView,
  ClientFormRow,
  DataProvider,
  FormResponseRow,
  FormResponses,
  FormSummary,
  FormTokenView,
  FunderGrantView,
  GrantBreakdowns,
  GrantSummary,
  GrantView,
  HubInsights,
  HubOverview,
  IndicatorActual,
  IndicatorStatus,
  InsightsPeriod,
  IntakeBoard,
  IntakeReviewRow,
  IntakeStatusRow,
  OrgClientRow,
  OutcomePoint,
  PlanWithUsage,
  PlatformOrgRow,
  PlatformOverview,
  ReportingResult,
  DuplicateGroup,
  RoomDetail,
  RoomView,
  OnboardingDocStatus,
  OrgOnboardingReview,
  SupervisionOverview,
  TeamMemberDetail,
  TeamMemberView,
  TeamThread,
} from "@/lib/data-provider";
import type {
  Appointment,
  Client,
  Counsellor,
  Demographics,
  Document,
  DocumentFolder,
  DocumentRequest,
  Form,
  FormAssignment,
  FormSnapshot,
  Grant,
  GrantIndicator,
  Invoice,
  Org,
  OutcomeMeasure,
  Room,
  Service,
  SessionNote,
  StorageUsage,
} from "@/lib/domain/types";
import type { FormStatus } from "@/lib/domain/enums";
import { storageLimitBytes } from "@/lib/documents/quota";
import {
  aiRailConfig,
  bookingSettings,
  platformSettings,
  orgSubscriptions,
  invoiceSettings,
  carePlans,
  clientApptTemplates,
  clientDocuments,
  clientProfiles,
  clientOutcomes,
  clients as allClients,
  consents as allConsents,
  conversations,
  integrationsCatalogue,
  plans,
  platformAuditEvents,
  onboardingRequirements,
  orgOnboardingDocs,
  platformOrgs,
  counsellorDayTemplates,
  counsellors as allCounsellors,
  demographics as allDemographics,
  funderContacts,
  funders,
  grantAllocations,
  grantIndicators,
  grantNarratives,
  grants,
  intakeForms,
  intakeResponses,
  orgForms,
  formAssignments as formAssignmentsSeed,
  invoices as allInvoices,
  orgExtraInvoices,
  orgPublicContent,
  orgs,
  outcomeSeries,
  roomAssignments,
  rooms as allRooms,
  services as allServices,
  sites as allSites,
  supervisionTemplates,
  teamMembers,
  teamProfiles,
  teamThreads,
} from "@/lib/mock/fixtures";
import { isConsentActive } from "@/lib/consent";
import { liveOnly } from "@/lib/retention";
import { applyKAnon, isoWeekday, roomUtilisation, SAST_OFFSET } from "@/lib/domain/helpers";
import type { ConsentPurpose } from "@/lib/domain/enums";
import {
  AGE_BAND_LABELS,
  EMPLOYMENT_LABELS,
  GENDER_LABELS,
  POPULATION_GROUP_LABELS,
} from "@/lib/domain/labels";

/** Clients with at least one captured outcome measure (drives honest coverage). */
const MEASURED_CLIENTS = new Set(["cl_lerato", "cl_johan", "cl_zanele", "cl_fatima"]);

/* ---- SAST calendar helpers (fixed offset, no DST) --------------------- */

function sastDate(nowISO: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowISO));
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoWeekRange(date: string): { from: string; to: string } {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // Sun=0
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const from = addDays(date, mondayOffset);
  return { from, to: addDays(from, 6) };
}

/** Deterministically materialise a counsellor's appointments around `now`. */
function materialise(counsellorId: string, nowISO: string): Appointment[] {
  const template = counsellorDayTemplates[counsellorId] ?? [];
  const today = sastDate(nowISO);
  return template.map((entry, i) => {
    const date = addDays(today, entry.dayOffset);
    const service = allServices.find((s) => s.id === entry.serviceId);
    return {
      id: `appt_${counsellorId}_${i}`,
      orgId: allCounsellors.find((c) => c.id === counsellorId)?.orgId ?? "",
      clientId: entry.clientId,
      counsellorId,
      serviceId: entry.serviceId,
      type: entry.type,
      roomId: entry.roomId,
      startsAt: `${date}T${entry.time}:00${SAST_OFFSET}`,
      durationMin: service?.durationMin ?? 60,
      state: entry.state,
      tags: entry.tags,
    };
  });
}

/** Materialise a client's own appointments around `now`. */
function materialiseClient(clientId: string, nowISO: string): Appointment[] {
  const template = clientApptTemplates[clientId] ?? [];
  const today = sastDate(nowISO);
  return template.map((entry, i) => {
    const service = allServices.find((s) => s.id === entry.serviceId);
    const date = addDays(today, entry.dayOffset);
    return {
      id: `appt_${clientId}_${i}`,
      orgId: allClients.find((c) => c.id === clientId)?.orgId ?? "",
      clientId,
      counsellorId: entry.counsellorId,
      serviceId: entry.serviceId,
      type: entry.type,
      roomId: entry.roomId,
      startsAt: `${date}T${entry.time}:00${SAST_OFFSET}`,
      durationMin: service?.durationMin ?? 60,
      state: entry.state,
    };
  });
}

function toView(appt: Appointment): AppointmentView {
  const client = allClients.find((c) => c.id === appt.clientId);
  const service = allServices.find((s) => s.id === appt.serviceId);
  const counsellor = allCounsellors.find((c) => c.id === appt.counsellorId);
  const room = allRooms.find((r) => r.id === appt.roomId);
  return {
    ...appt,
    clientName: client?.name ?? "Unknown client",
    serviceName: service?.name ?? "Session",
    counsellorName: counsellor?.name ?? "",
    roomName: room?.name ?? null,
  };
}

function shiftISO(nowISO: string, days: number): string {
  return new Date(new Date(nowISO).getTime() + days * 86_400_000).toISOString();
}

/** A client's sessions  their own template if present, else derived from the counsellors'. */
function clientAppointments(clientId: string, now: string): Appointment[] {
  if (clientApptTemplates[clientId]) return materialiseClient(clientId, now);
  const out: Appointment[] = [];
  for (const cid of Object.keys(counsellorDayTemplates)) {
    out.push(...materialise(cid, now).filter((a) => a.clientId === clientId));
  }
  return out;
}

/** Resolve a materialised appointment by id across both namespaces. */
function findAppointment(id: string, now: string): Appointment | undefined {
  for (const cid of Object.keys(counsellorDayTemplates)) {
    const f = materialise(cid, now).find((a) => a.id === id);
    if (f) return f;
  }
  for (const clid of Object.keys(clientApptTemplates)) {
    const f = materialiseClient(clid, now).find((a) => a.id === id);
    if (f) return f;
  }
  return undefined;
}

function materialiseOutcomes(clientId: string, now: string): OutcomeMeasure[] {
  return (clientOutcomes[clientId] ?? []).map((o, i) => ({
    id: `om_${clientId}_${i}`,
    clientId,
    tool: o.tool,
    score: o.score,
    takenAt: shiftISO(now, -o.weeksAgo * 7),
  }));
}

function consentActiveFor(clientId: string, purpose: ConsentPurpose): boolean {
  return isConsentActive(
    allConsents.find((c) => c.clientId === clientId && c.purpose === purpose),
  );
}

/**
 * Resolve an org's booking settings: the configured seed if present, else honest
 * defaults  everything in-person, online only where the org has video, and an
 * unverified counsellor is *not* publicly bookable until their credential clears.
 */
function bookingSettingsFor(orgId: string): BookingSettings {
  const org = orgs.find((o) => o.id === orgId);
  const services = allServices.filter((s) => s.orgId === orgId);
  const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
  const seed = bookingSettings[orgId];
  return {
    orgId,
    publicBookingEnabled: seed?.publicBookingEnabled ?? true,
    minNoticeHours: seed?.minNoticeHours ?? 12,
    maxDaysAhead: seed?.maxDaysAhead ?? 60,
    requireIntake: seed?.requireIntake ?? true,
    requireDeposit: seed?.requireDeposit ?? false,
    depositCents: seed?.depositCents ?? 0,
    services: services.map((s) => {
      const o = seed?.services[s.id];
      return {
        serviceId: s.id,
        publiclyBookable: o?.publiclyBookable ?? true,
        inPerson: o?.inPerson ?? true,
        online: o?.online ?? Boolean(org?.features.video),
      };
    }),
    counsellors: counsellors.map((c) => {
      const o = seed?.counsellors[c.id];
      return { counsellorId: c.id, publiclyBookable: o?.publiclyBookable ?? c.credential.status === "verified" };
    }),
  };
}

/**
 * Seed the private note contextually (Part A has no note store). A safeguarding
 * session carries an unsigned draft; a completed one a signed, AI-drafted note.
 * Copy stays non-diagnostic and never names a method (Safeguarding Rule).
 */
function seedNote(appt: Appointment): SessionNote | null {
  if (appt.state === "risk_flagged") {
    return {
      id: `note_${appt.id}`,
      appointmentId: appt.id,
      authorCounsellorId: appt.counsellorId,
      body: "Client presented low and withdrawn; spoke about feeling overwhelmed at home. A safeguarding concern came up  stayed with it, agreed a follow-up within the week, and shared current support. To review with supervisor.",
      aiGenerated: false,
      signedAt: null,
    };
  }
  if (appt.state === "completed") {
    return {
      id: `note_${appt.id}`,
      appointmentId: appt.id,
      authorCounsellorId: appt.counsellorId,
      body: "Session focused on sleep and the morning routine. Client reports the wind-down steps are helping. Agreed two small between-session tasks. Mood gradually improving.",
      aiGenerated: true,
      signedAt: appt.startsAt,
    };
  }
  return null;
}

function weekDatesOf(nowISO: string): string[] {
  const { from } = isoWeekRange(sastDate(nowISO));
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}

function orgInvoicesFor(orgId: string): Invoice[] {
  const fromClients = Object.values(allInvoices).flat().filter((i) => i.orgId === orgId);
  const extra = orgExtraInvoices.filter((i) => i.orgId === orgId);
  return [...fromClients, ...extra].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

function caseloadStatusFor(client: Client, now: string): CaseloadStatus {
  const nowMs = new Date(now).getTime();
  const appts = clientAppointments(client.id, now);
  const past = appts.filter((a) => new Date(a.startsAt).getTime() <= nowMs);
  const held = past.filter((a) => ["completed", "no_show", "risk_flagged", "discharged"].includes(a.state));
  const last = past.sort((a, b) => a.startsAt.localeCompare(b.startsAt))[past.length - 1];
  if (client.riskFlag) return "at_risk";
  if (held.length === 0) return "new";
  if (last && nowMs - new Date(last.startsAt).getTime() > 60 * 86_400_000) return "inactive";
  return "active";
}

/** Count by a key extractor, returning {label,count} rows for k-anon. */
function countBy<T>(rows: readonly T[], key: (r: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function toBreakdown(rows: { label: string; count: number }[]): Breakdown[] {
  return applyKAnon(rows);
}

async function ok<T>(value: T): Promise<T> {
  return value;
}

/* ── Forms library store (Phase 18.6) ──────────────────────────────────────
 * Mutable in-memory stores so send/submit behave within a dev session. Seeds
 * resolve their relative offsets once, against a base captured at module load
 * (the same trick the rest of the demo uses via the frozen clock). */
const FORMS_BASE = new Date();
function agoIso(days: number): string {
  return new Date(FORMS_BASE.getTime() - days * 86_400_000).toISOString();
}
function snapshotOf(f: { kind: Form["kind"]; title: string; intro?: string; fields: Form["fields"] }): FormSnapshot {
  return { kind: f.kind, title: f.title, intro: f.intro, fields: f.fields };
}

const mockForms: Form[] = Object.entries(orgForms).flatMap(([orgId, list]) =>
  list.map((f) => ({
    id: f.id, orgId, kind: f.kind, title: f.title, intro: f.intro, fields: f.fields,
    status: f.status, theme: f.theme ?? null, shareToken: f.shareToken ?? null, shareEnabled: f.shareEnabled ?? false,
    createdAt: agoIso(f.createdDaysAgo), updatedAt: agoIso(f.updatedDaysAgo),
  })),
);

const mockAssignments: FormAssignment[] = formAssignmentsSeed.map((a) => {
  const form = mockForms.find((f) => f.id === a.formId);
  const orgId = form?.orgId ?? "";
  return {
    id: a.id, orgId, formId: a.formId, clientId: a.clientId, token: a.token, status: a.status,
    snapshot: form ? snapshotOf(form) : { kind: "custom", title: "Form", fields: [] },
    answers: a.answers ?? null,
    sentBy: "system",
    sentAt: agoIso(a.sentDaysAgo),
    submittedAt: a.submittedDaysAgo != null ? agoIso(a.submittedDaysAgo) : null,
  };
});

let formSeq = 1;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(formSeq++).toString(36)}`;
const newToken = () => `f_${Math.random().toString(36).slice(2, 10)}${(formSeq++).toString(36)}`;

export const mockProvider: DataProvider = {
  getOrg: (orgId) => ok(orgs.find((o) => o.id === orgId) ?? null),
  getOrgBySlug: (slug) => ok(orgs.find((o) => o.slug === slug) ?? null),
  listOrgSlugs: () => ok(orgs.map((o) => o.slug)),

  getOrgPublicPage: (slug) => {
    const org = orgs.find((o) => o.slug === slug);
    if (!org) return ok(null);
    const content = orgPublicContent[org.id];
    return ok({
      org,
      intro: content?.intro ?? "",
      about: content?.about ?? "",
      sites: allSites.filter((s) => s.orgId === org.id),
      offersOnline: content?.offersOnline ?? false,
      // Only registered, presentable team is shown; nothing sensitive.
      services: allServices.filter((s) => s.orgId === org.id),
      team: allCounsellors.filter((c) => c.orgId === org.id),
    });
  },

  getBookingConfig: (slug) => {
    const org = orgs.find((o) => o.slug === slug);
    if (!org) return ok(null);
    const intakeForm = intakeForms[org.id];
    if (!intakeForm) return ok(null);
    const settings = bookingSettingsFor(org.id);
    const bookableService = new Set(settings.services.filter((s) => s.publiclyBookable).map((s) => s.serviceId));
    const bookableCounsellor = new Set(settings.counsellors.filter((c) => c.publiclyBookable).map((c) => c.counsellorId));
    return ok({
      org,
      // The org's booking settings decide what the public actually sees.
      services: allServices.filter((s) => s.orgId === org.id && bookableService.has(s.id)),
      counsellors: allCounsellors.filter((c) => c.orgId === org.id && bookableCounsellor.has(c.id)),
      intakeForm,
      enabled: settings.publicBookingEnabled,
      minNoticeHours: settings.minNoticeHours,
      maxDaysAhead: settings.maxDaysAhead,
      serviceModalities: Object.fromEntries(
        settings.services.filter((s) => bookableService.has(s.serviceId)).map((s) => [s.serviceId, { inPerson: s.inPerson, online: s.online }]),
      ),
      deposit: { required: settings.requireDeposit, cents: settings.depositCents },
    });
  },

  getBookingSettings: (orgId) => ok(bookingSettingsFor(orgId)),

  getPlatformSettings: () => ok({ vatRatePercent: platformSettings.vatRatePercent }),

  getOrgSubscription: (orgId, now) => {
    const sub = orgSubscriptions[orgId];
    const plan = sub ? plans.find((p) => p.id === sub.planId) : undefined;
    if (!sub || !plan) return ok(null);
    const d = new Date(now);
    const nextBillingAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
    return ok({ plan, status: sub.status, nextBillingAt, billedVia: "Phila platform billing" });
  },

  getInvoiceSettings: (orgId) => {
    const s = invoiceSettings[orgId];
    return ok(
      s
        ? { orgId, ...s }
        : { orgId, vatRegistered: false, vatNumber: "", pricesIncludeVat: false, invoicePrefix: "INV", paymentTermsDays: 14, bankName: "", accountName: "", accountNumber: "", branchCode: "", showPayButton: false },
    );
  },

  getHubInsights: (orgId, now, filters): Promise<HubInsights> => {
    const period: InsightsPeriod = filters.period ?? "month";
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const clients = liveOnly(allClients.filter((c) => c.orgId === orgId));
    const appts = counsellors.flatMap((c) => materialise(c.id, now));
    const nowMs = new Date(now).getTime();
    const today = sastDate(now);
    const week = isoWeekRange(today);
    const month = today.slice(0, 7);

    const live = appts.filter((a) => a.state !== "cancelled");
    const onDay = (d: string) => live.filter((a) => a.startsAt.startsWith(d)).length;
    const inWeek = (d: string) => d >= week.from && d <= week.to;
    const sessionsToday = onDay(today);
    const sessionsWeek = live.filter((a) => inWeek(a.startsAt.slice(0, 10))).length;
    const sessionsMonth = live.filter((a) => a.startsAt.startsWith(month)).length;

    // The selected window [from, to] (inclusive date strings).
    const ms = (mStr: string, delta: number) => {
      const [y, m] = mStr.split("-").map(Number);
      return new Date(Date.UTC((y as number), (m as number) - 1 + delta, 1)).toISOString().slice(0, 7);
    };
    const monthEnd = (mStr: string) => {
      const [y, m] = mStr.split("-").map(Number);
      return new Date(Date.UTC((y as number), (m as number), 0)).toISOString().slice(0, 10);
    };
    const window =
      period === "week"
        ? { from: week.from, to: week.to }
        : period === "month"
          ? { from: `${month}-01`, to: monthEnd(month) }
          : { from: `${ms(month, -2)}-01`, to: monthEnd(month) };
    const inWindow = (iso: string) => { const d = iso.slice(0, 10); return d >= window.from && d <= window.to; };

    const windowLive = live.filter((a) => inWindow(a.startsAt));
    const completed = windowLive.filter((a) => a.state === "completed" || a.state === "discharged").length;
    const upcoming = windowLive.filter((a) => a.state === "scheduled" && new Date(a.startsAt).getTime() > nowMs).length;
    const noShows = windowLive.filter((a) => a.state === "no_show").length;
    const cancelled = appts.filter((a) => a.state === "cancelled" && inWindow(a.startsAt)).length;
    const attendanceRate = completed + noShows === 0 ? 0 : Math.round((completed / (completed + noShows)) * 100);
    const activeClients = new Set(windowLive.map((a) => a.clientId)).size;
    const newClients = clients.filter((c) => inWindow(c.createdAt)).length;
    const revenueActualCents = orgInvoicesFor(orgId)
      .filter((i) => i.status === "paid" && inWindow(i.issuedAt))
      .reduce((s, i) => s + i.amountCents, 0);

    // Trends  always day-level (this week) + month-level (last 6 months).
    const shortMonth = (mStr: string) => new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(new Date(`${mStr}-01T12:00:00Z`));
    const shortDay = (d: string) => new Intl.DateTimeFormat("en-ZA", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
    const byDay = Array.from({ length: 7 }, (_, i) => addDays(week.from, i)).map((d) => ({ key: d, label: shortDay(d), count: onDay(d) }));
    const byMonth = Array.from({ length: 6 }, (_, i) => ms(month, -(5 - i))).map((mStr) => ({
      key: mStr,
      label: shortMonth(mStr),
      count: live.filter((a) => a.startsAt.startsWith(mStr)).length,
    }));

    // Client mix  consented demographics, real counts (no k-anon: internal view).
    const consentedIds = new Set(clients.filter((c) => consentActiveFor(c.id, "demographics")).map((c) => c.id));
    let demos = allDemographics.filter((d) => consentedIds.has(d.clientId));
    const withDemographics = demos.length;
    if (filters.gender) demos = demos.filter((d) => d.gender === filters.gender);
    if (filters.province) demos = demos.filter((d) => d.province === filters.province);
    if (filters.ageBand) demos = demos.filter((d) => d.ageBand === filters.ageBand);

    return ok({
      period,
      sessionsToday,
      sessionsWeek,
      sessionsMonth,
      completed,
      upcoming,
      cancelled,
      noShows,
      attendanceRate,
      newClients,
      activeClients,
      revenueActualCents,
      byDay,
      byMonth,
      totalClients: clients.length,
      matchedClients: demos.length,
      withDemographics,
      byGender: countBy(demos, (d) => GENDER_LABELS[d.gender]),
      byAgeBand: countBy(demos, (d) => AGE_BAND_LABELS[d.ageBand]),
      byProvince: countBy(demos, (d) => d.province),
    });
  },

  getCounsellor: (id) => ok(allCounsellors.find((c) => c.id === id) ?? null),
  listCounsellors: (orgId) => ok(allCounsellors.filter((c) => c.orgId === orgId)),
  listClients: (orgId) => ok(liveOnly(allClients.filter((c) => c.orgId === orgId))),
  listServices: (orgId) => ok(allServices.filter((s) => s.orgId === orgId)),
  listRooms: (orgId) => ok(allRooms.filter((r) => r.orgId === orgId)),

  listAppointmentsForCounsellor: (counsellorId, opts) => {
    const all = materialise(counsellorId, opts?.from ?? new Date().toISOString());
    return ok(filterRange(all, opts));
  },

  listAppointmentsForOrg: (orgId, opts) => {
    const counsellorIds = allCounsellors.filter((c) => c.orgId === orgId).map((c) => c.id);
    const anchor = opts?.from ?? new Date().toISOString();
    const all = counsellorIds.flatMap((id) => materialise(id, anchor));
    return ok(filterRange(all, opts));
  },

  async getCounsellorDashboard(_orgId, counsellorId, now): Promise<CounsellorDashboard | null> {
    const counsellor = allCounsellors.find((c) => c.id === counsellorId);
    if (!counsellor) return null;
    const org = orgs.find((o) => o.id === counsellor.orgId);
    if (!org) return null;

    const today = sastDate(now);
    const week = isoWeekRange(today);
    const all = materialise(counsellorId, now);

    const todays = all
      .filter((a) => a.startsAt.startsWith(today))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toView);

    const weekAppts = all.filter((a) => {
      const d = a.startsAt.slice(0, 10);
      return d >= week.from && d <= week.to;
    });

    const counsellorClients = liveOnly(
      allClients.filter((c) => c.primaryCounsellorId === counsellorId),
    );
    const measured = counsellorClients.filter((c) => MEASURED_CLIENTS.has(c.id)).length;

    const noShows = weekAppts.filter((a) => a.state === "no_show").length;
    const heldOrMissed = weekAppts.filter((a) =>
      ["completed", "no_show", "risk_flagged"].includes(a.state),
    ).length;

    return {
      org,
      counsellor,
      today: todays,
      stats: {
        clientsToday: new Set(todays.map((a) => a.clientId)).size,
        completedToday: todays.filter((a) => a.state === "completed").length,
        sessionsThisWeek: weekAppts.filter((a) =>
          ["scheduled", "completed", "risk_flagged"].includes(a.state),
        ).length,
        outcomesCoverage: { captured: measured, total: counsellorClients.length },
        noShowRate: {
          rate: heldOrMissed === 0 ? 0 : Math.round((noShows / heldOrMissed) * 100),
          window: "this week",
        },
      },
      outcomes: {
        tool: "PHQ-9",
        points: outcomeSeries[counsellorId] ?? [],
        coverage: { captured: measured, total: counsellorClients.length },
      },
      attention: buildAttention(todays, weekAppts),
    };
  },

  // ---- Client portal (own data only) ----------------------------------
  getClient: (clientId) => ok(allClients.find((c) => c.id === clientId) ?? null),

  getClientProfile: (clientId): Promise<ClientProfileView | null> => {
    const client = allClients.find((c) => c.id === clientId);
    if (!client) return ok(null);
    const p = clientProfiles[clientId];
    const counsellor = allCounsellors.find((c) => c.id === client.primaryCounsellorId);
    return ok({
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      province: client.province,
      dateOfBirth: p?.dateOfBirth ?? "",
      address: p?.address ?? "",
      emergencyName: p?.emergencyName ?? "",
      emergencyPhone: p?.emergencyPhone ?? "",
      preferredContact: p?.preferredContact ?? "WhatsApp",
      counsellorName: counsellor?.name ?? "your counsellor",
      memberSince: client.createdAt,
    });
  },

  listAppointmentsForClient: (clientId, now) =>
    ok(
      materialiseClient(clientId, now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(toView),
    ),

  getCarePlan: (clientId) => ok(carePlans[clientId] ?? null),
  listClientDocuments: (clientId) => ok(clientDocuments[clientId] ?? []),

  // Documents (Phase 18)  derive from the legacy fixtures; folders/requests empty in mock.
  listOrgDocuments: (orgId) =>
    ok(
      Object.values(clientDocuments)
        .flat()
        .filter((d) => d.orgId === orgId)
        .map(
          (d): Document => ({
            id: d.id, orgId: d.orgId, folderId: null, clientId: d.clientId, counsellorId: null,
            sessionId: null, name: d.name, kind: d.kind, visibility: "client_visible",
            storageProvider: "supabase", storageKey: null, contentType: null, bytes: 0,
            sizeLabel: d.sizeLabel, scanStatus: "clean", uploadedBy: null, sharedBy: d.sharedBy,
            requestId: null, createdAt: d.createdAt,
          }),
        ),
    ),
  listOrgFolders: () => ok([] as DocumentFolder[]),
  listDocumentRequests: () => ok([] as DocumentRequest[]),
  getStorageUsage: (orgId) => ok<StorageUsage>({ orgId, bytesUsed: 0, bytesLimit: storageLimitBytes() }),
  listClientVisibleDocuments: (clientId) =>
    ok(
      (clientDocuments[clientId] ?? []).map(
        (d): Document => ({
          id: d.id, orgId: d.orgId, folderId: null, clientId: d.clientId, counsellorId: null,
          sessionId: null, name: d.name, kind: d.kind, visibility: "client_visible",
          storageProvider: "supabase", storageKey: null, contentType: null, bytes: 0,
          sizeLabel: d.sizeLabel, scanStatus: "clean", uploadedBy: null, sharedBy: d.sharedBy,
          requestId: null, createdAt: d.createdAt,
        }),
      ),
    ),
  listClientDocumentRequests: () => ok([] as DocumentRequest[]),
  listCounsellorDocuments: () => ok({ own: [] as Document[], shared: [] as Document[] }),
  listClientInvoices: (clientId) => ok(allInvoices[clientId] ?? []),
  getClientConsents: (clientId) => ok(allConsents.filter((c) => c.clientId === clientId)),

  // ---- Counsellor workspace -------------------------------------------
  listCaseload: (_orgId, counsellorId, now) => {
    const clients = liveOnly(allClients.filter((c) => c.primaryCounsellorId === counsellorId));
    const nowMs = new Date(now).getTime();
    const rows: CaseloadRow[] = clients.map((client) => {
      const appts = clientAppointments(client.id, now)
        .map(toView)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const past = appts.filter((a) => new Date(a.startsAt).getTime() <= nowMs);
      const future = appts.filter(
        (a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled",
      );
      const held = past.filter((a) =>
        ["completed", "no_show", "risk_flagged", "discharged"].includes(a.state),
      );
      const lastSession = past[past.length - 1] ?? null;
      const status: CaseloadStatus = client.riskFlag
        ? "at_risk"
        : held.length === 0
          ? "new"
          : lastSession && nowMs - new Date(lastSession.startsAt).getTime() > 60 * 86_400_000
            ? "inactive"
            : "active";
      return { client, nextSession: future[0] ?? null, lastSession, sessionCount: held.length, status };
    });
    return ok(rows);
  },

  getClientDossier: (orgId, clientId, now) => {
    const client = allClients.find((c) => c.id === clientId && c.orgId === orgId);
    if (!client) return ok(null);
    const org = orgs.find((o) => o.id === client.orgId);
    const counsellor = allCounsellors.find((c) => c.id === client.primaryCounsellorId);
    if (!org || !counsellor) return ok(null);
    const demographicsAllowed = consentActiveFor(clientId, "demographics");
    return ok({
      client,
      org,
      counsellor,
      consents: allConsents.filter((c) => c.clientId === clientId),
      demographics: demographicsAllowed
        ? (allDemographics.find((d) => d.clientId === clientId) ?? null)
        : null,
      sessions: clientAppointments(clientId, now)
        .map(toView)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      outcomes: materialiseOutcomes(clientId, now),
      documents: clientDocuments[clientId] ?? [],
      carePlan: carePlans[clientId] ?? null,
    });
  },

  listCounsellorSessions: (_orgId, counsellorId, now) =>
    ok(
      materialise(counsellorId, now)
        .map(toView)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    ),

  getSession: (_orgId, appointmentId, now) => {
    const appt = findAppointment(appointmentId, now);
    if (!appt) return ok(null);
    const client = allClients.find((c) => c.id === appt.clientId);
    if (!client) return ok(null);

    // Continuity of care  where this session sits in the client's journey.
    const journey = clientAppointments(appt.clientId, now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const idx = journey.findIndex((a) => a.id === appt.id);
    const prior = [...journey]
      .reverse()
      .find((a) => a.startsAt < appt.startsAt && (a.state === "completed" || a.state === "discharged" || a.state === "risk_flagged"));
    const priorNote = prior ? seedNote(prior) : null;
    const plan = carePlans[appt.clientId] ?? null;

    return ok({
      appointment: toView(appt),
      client,
      demographicsConsented: consentActiveFor(appt.clientId, "demographics"),
      note: seedNote(appt),
      carePlan: plan,
      outcomes: materialiseOutcomes(appt.clientId, now),
      continuity: {
        sessionNumber: idx >= 0 ? idx + 1 : journey.length,
        totalSessions: journey.length,
        previousDate: prior?.startsAt ?? null,
        previousSummary: priorNote?.body
          ? priorNote.body.length > 240 ? `${priorNote.body.slice(0, 240).trimEnd()}…` : priorNote.body
          : null,
        openGoals: plan ? plan.tasks.filter((t) => !t.done).map((t) => t.text) : [],
      },
    });
  },

  listConversations: (counsellorId): Promise<Conversation[]> =>
    ok(
      (conversations[counsellorId] ?? [])
        .map((c) => ({
          clientId: c.clientId,
          clientName: c.clientName,
          unread: c.unread,
          lastAt: c.messages[c.messages.length - 1]?.at ?? "",
          messages: c.messages,
        }))
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    ),

  listTeamThreads: (userId): Promise<TeamThread[]> =>
    ok(
      teamThreads
        .filter((t) => t.participants.includes(userId))
        .map((t) => {
          const otherId = t.participants[0] === userId ? t.participants[1] : t.participants[0];
          const other = teamMembers.find((m) => m.userId === otherId);
          return {
            id: t.id,
            kind: "direct" as const,
            otherUserId: otherId,
            otherName: other?.name ?? "Team member",
            otherRole: other?.teamRole ?? "counsellor",
            unread: t.unreadFor === userId ? 1 : 0,
            lastAt: t.messages[t.messages.length - 1]?.at ?? "",
            messages: t.messages.map((m) => ({ id: m.id, from: m.from === userId ? ("me" as const) : ("them" as const), text: m.text, at: m.at })),
          };
        })
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    ),

  getCounsellorRooms: (counsellorId, now): Promise<CounsellorRoomsView> => {
    const weekDates = weekDatesOf(now);
    const bookings = materialise(counsellorId, now)
      .map(toView)
      .filter((a) => a.roomId && weekDates.some((d) => a.startsAt.startsWith(d)))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const assignments = roomAssignments
      .filter((ra) => ra.counsellorId === counsellorId)
      .map((ra) => {
        const room = allRooms.find((r) => r.id === ra.roomId);
        return {
          roomName: room?.name ?? "Room",
          siteName: allSites.find((s) => s.id === room?.siteId)?.name ?? "",
          colour: room?.colour ?? "#1C7D58",
          days: ra.days,
          start: ra.start,
          end: ra.end,
        };
      });
    return ok({ assignments, bookings });
  },

  listCounsellorInvoices: (counsellorId) => {
    const counsellor = allCounsellors.find((c) => c.id === counsellorId);
    if (!counsellor) return ok([]);
    const clientIds = new Set(
      allClients.filter((c) => c.primaryCounsellorId === counsellorId).map((c) => c.id),
    );
    return ok(orgInvoicesFor(counsellor.orgId).filter((i) => clientIds.has(i.clientId)));
  },

  getSupervisionQueue: (supervisorId, now) => {
    const superviseeIds = new Set(
      allCounsellors.filter((c) => c.supervisorId === supervisorId).map((c) => c.id),
    );
    const items = supervisionTemplates
      .filter((t) => superviseeIds.has(t.superviseeId))
      .map((t, i) => {
        const sv = allCounsellors.find((c) => c.id === t.superviseeId);
        const service = allServices.find((s) => s.id === t.serviceId);
        return {
          id: `sup_${i}`,
          superviseeId: t.superviseeId,
          superviseeName: sv?.name ?? "Counsellor",
          clientName: t.clientName,
          serviceName: service?.name ?? "Session",
          sessionAt: shiftISO(now, t.sessionDayOffset),
          submittedAt: shiftISO(now, t.submittedDayOffset),
          noteExcerpt: t.note,
          aiGenerated: t.aiGenerated,
          riskFlagged: t.risk,
        };
      })
      .sort((a, b) => Number(b.riskFlagged) - Number(a.riskFlagged) || a.submittedAt.localeCompare(b.submittedAt));
    return ok(items);
  },

  getSupervisionOverview: (supervisorId, now): Promise<SupervisionOverview> => {
    void now;
    const supervisees = allCounsellors.filter((c) => c.supervisorId === supervisorId);
    const pendingBy = (cid: string) => supervisionTemplates.filter((t) => t.superviseeId === cid).length;
    const summaries = supervisees.map((c) => ({
      id: c.id,
      name: c.name,
      credential: { body: c.credential.body, status: c.credential.status },
      caseload: liveOnly(allClients.filter((cl) => cl.primaryCounsellorId === c.id)).length,
      pending: pendingBy(c.id),
    }));
    const pendingCount = summaries.reduce((s, x) => s + x.pending, 0);
    return ok({
      supervisees: summaries,
      pendingCount,
      // Honest mock figures for the demo; Part B computes from real sign-off logs.
      signedThisMonth: 14,
      avgTurnaroundHours: 19,
    });
  },

  // ---- Org-admin Hub --------------------------------------------------
  getHubOverview: (orgId, now): Promise<HubOverview | null> => {
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return ok(null);
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const clients = liveOnly(allClients.filter((c) => c.orgId === orgId));
    const appts = counsellors.flatMap((c) => materialise(c.id, now));
    const nowMs = new Date(now).getTime();
    const today = sastDate(now);
    const week = isoWeekRange(today);
    const month = today.slice(0, 7);

    const live = appts.filter((a) => a.state !== "cancelled");
    const clientsToday = new Set(live.filter((a) => a.startsAt.startsWith(today)).map((a) => a.clientId)).size;
    const inWeek = live.filter((a) => {
      const d = a.startsAt.slice(0, 10);
      return d >= week.from && d <= week.to;
    });
    const clientsWeek = new Set(inWeek.map((a) => a.clientId)).size;
    const clientsMonth = new Set(live.filter((a) => a.startsAt.startsWith(month)).map((a) => a.clientId)).size;

    const invoices = orgInvoicesFor(orgId);
    const inDay = (iso: string) => iso.startsWith(today);
    const inWk = (iso: string) => { const d = iso.slice(0, 10); return d >= week.from && d <= week.to; };
    const paidSum = (pred: (iso: string) => boolean) =>
      invoices.filter((i) => i.status === "paid" && pred(i.issuedAt)).reduce((s, i) => s + i.amountCents, 0);
    const priceOf = (serviceId: string) => allServices.find((x) => x.id === serviceId)?.priceCents ?? 0;
    const futureSum = (pred: (iso: string) => boolean) =>
      appts
        .filter((a) => a.state === "scheduled" && new Date(a.startsAt).getTime() > nowMs && pred(a.startsAt))
        .reduce((s, a) => s + priceOf(a.serviceId), 0);

    const incomeMonthCents = paidSum((iso) => iso.startsWith(month));
    const incomeTodayCents = paidSum(inDay);
    const incomeWeekCents = paidSum(inWk);
    const incomePredictionCents = incomeMonthCents + futureSum((iso) => iso.startsWith(month));
    const income = {
      todayCents: incomeTodayCents,
      weekCents: incomeWeekCents,
      predictedTodayCents: incomeTodayCents + futureSum(inDay),
      predictedWeekCents: incomeWeekCents + futureSum(inWk),
    };

    // New clients (by intake/createdAt) per period  honest, soft-deletes excluded.
    const createdInDay = (iso: string) => iso.startsWith(today);
    const newClientsToday = clients.filter((c) => createdInDay(c.createdAt)).length;
    const newClientsWeek = clients.filter((c) => inWk(c.createdAt)).length;
    const newClientsMonth = clients.filter((c) => c.createdAt.startsWith(month)).length;

    const heldWeek = inWeek.filter((a) => ["completed", "no_show", "risk_flagged"].includes(a.state));
    const noShows = inWeek.filter((a) => a.state === "no_show").length;
    const noShowRate = heldWeek.length === 0 ? 0 : Math.round((noShows / heldWeek.length) * 100);

    const pendingCredentials = counsellors.filter((c) => ["pending", "unverified"].includes(c.credential.status)).length;
    const openIntakes = clients.filter(
      (c) => clientAppointments(c.id, now).filter((a) => a.state === "completed" || a.state === "discharged").length === 0,
    ).length;
    const measured = clients.filter((c) => (clientOutcomes[c.id]?.length ?? 0) > 0).length;

    const attention: AttentionItem[] = [];
    for (const c of clients) {
      if (c.riskFlag)
        attention.push({
          id: `risk_${c.id}`,
          tone: "rose",
          title: `Safeguarding  ${c.name}`,
          detail: "A counsellor has flagged a safeguarding concern.",
          href: "/hub/clients",
        });
    }
    if (pendingCredentials > 0)
      attention.push({
        id: "creds",
        tone: "amber",
        title: `${pendingCredentials} credential ${pendingCredentials === 1 ? "check" : "checks"} pending`,
        detail: "Verify HPCSA / ASCHP / SACSSP registration before clients are assigned.",
        href: "/hub/team",
      });

    return ok({
      clientsToday,
      clientsWeek,
      clientsMonth,
      newClientsToday,
      newClientsWeek,
      newClientsMonth,
      incomeMonthCents,
      incomePredictionCents,
      income,
      noShowRate,
      openIntakes,
      pendingCredentials,
      outcomesCoverage: { captured: measured, total: clients.length },
      attention,
    });
  },

  listOrgClients: (orgId, now) => {
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const clients = liveOnly(allClients.filter((c) => c.orgId === orgId));
    const nowMs = new Date(now).getTime();
    const rows: OrgClientRow[] = clients.map((client) => {
      const appts = clientAppointments(client.id, now)
        .map(toView)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const past = appts.filter((a) => new Date(a.startsAt).getTime() <= nowMs);
      const future = appts.filter((a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled");
      const counsellor = counsellors.find((c) => c.id === client.primaryCounsellorId);
      return {
        client,
        counsellorName: counsellor?.name ?? "Unassigned",
        nextSession: future[0] ?? null,
        lastSession: past[past.length - 1] ?? null,
        status: caseloadStatusFor(client, now),
      };
    });
    return ok(rows);
  },

  listRemovedClients: (orgId, now) => {
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const clients = allClients.filter((c) => c.orgId === orgId && c.deletedAt);
    const nowMs = new Date(now).getTime();
    const rows: OrgClientRow[] = clients.map((client) => {
      const appts = clientAppointments(client.id, now).map(toView).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const past = appts.filter((a) => new Date(a.startsAt).getTime() <= nowMs);
      const future = appts.filter((a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled");
      const counsellor = counsellors.find((c) => c.id === client.primaryCounsellorId);
      return { client, counsellorName: counsellor?.name ?? "Unassigned", nextSession: future[0] ?? null, lastSession: past[past.length - 1] ?? null, status: caseloadStatusFor(client, now) };
    });
    return ok(rows);
  },

  findDuplicateClients: (orgId, now): Promise<DuplicateGroup[]> => {
    const list = liveOnly(allClients.filter((c) => c.orgId === orgId));
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const digits = (s: string) => s.replace(/\D/g, "");

    // Union-find: link clients that share a normalised name, phone, or email.
    const parent = new Map<string, string>(list.map((c) => [c.id, c.id]));
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      return r;
    };
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

    const keyToIds = new Map<string, string[]>();
    const addKey = (k: string, id: string) => keyToIds.set(k, [...(keyToIds.get(k) ?? []), id]);
    for (const c of list) {
      addKey(`n:${norm(c.name)}`, c.id);
      if (c.phone) addKey(`p:${digits(c.phone)}`, c.id);
      if (c.email) addKey(`e:${norm(c.email)}`, c.id);
    }
    for (const ids of keyToIds.values()) {
      for (let i = 1; i < ids.length; i++) union(ids[0]!, ids[i]!);
    }

    const groups = new Map<string, string[]>();
    for (const c of list) {
      const r = find(c.id);
      groups.set(r, [...(groups.get(r) ?? []), c.id]);
    }

    const result: DuplicateGroup[] = [];
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const cs = ids.map((id) => list.find((c) => c.id === id)!);
      const sameName = new Set(cs.map((c) => norm(c.name))).size === 1;
      const samePhone = cs.every((c) => c.phone) && new Set(cs.map((c) => digits(c.phone!))).size === 1;
      const reason = sameName && samePhone ? "Same name and phone" : sameName ? "Same name" : samePhone ? "Same phone number" : "Shared contact details";
      result.push({
        reason,
        clients: cs
          .map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone ?? null,
            email: c.email ?? null,
            counsellorName: allCounsellors.find((cc) => cc.id === c.primaryCounsellorId)?.name ?? "",
            sessions: clientAppointments(c.id, now).length,
            createdAt: c.createdAt,
          }))
          .sort((a, b) => b.sessions - a.sessions || a.createdAt.localeCompare(b.createdAt)),
      });
    }
    return ok(result);
  },

  listTeam: (orgId): Promise<TeamMemberView[]> => {
    void orgId; // single-org demo; teamMembers are all Masizakhe
    return ok(
      teamMembers.map((m) => {
        const counsellor = m.counsellorId ? allCounsellors.find((c) => c.id === m.counsellorId) : undefined;
        return {
          userId: m.userId,
          name: m.name,
          email: m.email,
          teamRole: m.teamRole,
          isSupervisor: m.isSupervisor,
          active: m.active,
          credential: counsellor ? { body: counsellor.credential.body, status: counsellor.credential.status } : null,
          joinedAt: m.joinedAt,
        };
      }),
    );
  },

  getTeamMemberDetail: (orgId, userId, now): Promise<TeamMemberDetail | null> => {
    const m = teamMembers.find((t) => t.userId === userId);
    if (!m) return ok(null);
    const counsellor = m.counsellorId ? allCounsellors.find((c) => c.id === m.counsellorId) : undefined;
    const member = {
      userId: m.userId,
      name: m.name,
      email: m.email,
      teamRole: m.teamRole,
      isSupervisor: m.isSupervisor,
      active: m.active,
      credential: counsellor ? { body: counsellor.credential.body, status: counsellor.credential.status } : null,
      joinedAt: m.joinedAt,
    };

    let caseload: { id: string; name: string; riskFlag: boolean }[] = [];
    let upcoming: ReturnType<typeof toView>[] = [];
    let stats: { caseload: number; sessionsWeek: number; seenWeek: number } | null = null;
    let roomSchedule: { roomName: string; days: number[]; start: string; end: string }[] = [];
    let supervisorName: string | null = null;

    if (counsellor) {
      const myClients = liveOnly(allClients.filter((c) => c.primaryCounsellorId === counsellor.id && c.orgId === orgId));
      caseload = myClients.map((c) => ({ id: c.id, name: c.name, riskFlag: c.riskFlag }));
      const appts = materialise(counsellor.id, now).map(toView);
      const weekDates = weekDatesOf(now);
      const wk = appts.filter((a) => weekDates.some((d) => a.startsAt.startsWith(d)));
      upcoming = appts
        .filter((a) => a.startsAt >= now && a.state === "scheduled")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 6);
      stats = {
        caseload: myClients.length,
        sessionsWeek: wk.length,
        seenWeek: wk.filter((a) => a.state === "completed" || a.state === "discharged").length,
      };
      roomSchedule = roomAssignments
        .filter((ra) => ra.counsellorId === counsellor.id)
        .map((ra) => ({ roomName: allRooms.find((r) => r.id === ra.roomId)?.name ?? "Room", days: ra.days, start: ra.start, end: ra.end }));
      supervisorName = counsellor.supervisorId ? (allCounsellors.find((c) => c.id === counsellor.supervisorId)?.name ?? null) : null;
    }

    return ok({
      member,
      profile: teamProfiles[userId] ?? null,
      registrationNo: counsellor?.credential.registrationNo ?? null,
      counsellorId: counsellor?.id ?? null,
      supervisorId: counsellor?.supervisorId ?? null,
      supervisorName,
      roomSchedule,
      caseload,
      upcoming,
      stats,
    });
  },

  getRoomsOverview: (orgId, now): Promise<RoomView[]> => {
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return ok([]);
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const appts = counsellors.flatMap((c) => materialise(c.id, now)).map(toView);
    const weekDates = weekDatesOf(now);
    const rooms = allRooms.filter((r) => r.orgId === orgId);
    return ok(
      rooms.map((room) => {
        const roomAppts = appts.filter((a) => a.roomId === room.id);
        return {
          room,
          siteName: allSites.find((s) => s.id === room.siteId)?.name ?? "",
          utilisation: roomUtilisation({
            appointments: roomAppts,
            businessHours: org.scheduling.businessHours,
            weekDates,
          }),
          assignments: roomAssignments
            .filter((ra) => ra.roomId === room.id)
            .map((ra) => ({
              counsellorName: counsellors.find((c) => c.id === ra.counsellorId)?.name ?? "",
              days: ra.days,
              start: ra.start,
              end: ra.end,
            })),
          bookings: roomAppts
            .filter((a) => weekDates.some((d) => a.startsAt.startsWith(d)))
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        };
      }),
    );
  },

  listSites: (orgId) => ok(allSites.filter((s) => s.orgId === orgId)),

  getRoomDetail: (orgId, roomId, now): Promise<RoomDetail | null> => {
    const room = allRooms.find((r) => r.id === roomId && r.orgId === orgId);
    if (!room) return ok(null);
    const org = orgs.find((o) => o.id === room.orgId);
    if (!org) return ok(null);
    const bh = org.scheduling.businessHours;
    const counsellors = allCounsellors.filter((c) => c.orgId === room.orgId);
    const appts = counsellors.flatMap((c) => materialise(c.id, now)).map(toView);
    const weekDates = weekDatesOf(now);
    const today = sastDate(now);
    const roomAppts = appts.filter((a) => a.roomId === room.id);

    const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    const openMinutes = (date: string) => {
      const h = bh[isoWeekday(date)];
      if (!h) return 0;
      const breaks = (h.breaks ?? []).reduce((s, b) => s + (toMin(b.end) - toMin(b.start)), 0);
      return Math.max(0, toMin(h.end) - toMin(h.start) - breaks);
    };

    const perDay = weekDates.map((date) => {
      const openMin = openMinutes(date);
      const bookedMin = roomAppts.filter((a) => a.startsAt.startsWith(date)).reduce((s, a) => s + a.durationMin, 0);
      const freeMin = Math.max(0, openMin - bookedMin);
      return {
        date,
        dow: isoWeekday(date),
        openMin,
        bookedMin,
        freeMin,
        pct: openMin === 0 ? 0 : Math.min(100, Math.round((bookedMin / openMin) * 100)),
        isToday: date === today,
      };
    });

    return ok({
      room,
      siteName: allSites.find((s) => s.id === room.siteId)?.name ?? "",
      businessHours: bh,
      utilisation: roomUtilisation({ appointments: roomAppts, businessHours: bh, weekDates }),
      perDay,
      freeHours: Math.round((perDay.reduce((s, d) => s + d.freeMin, 0) / 60) * 10) / 10,
      capacityNote: `Seats ${room.capacity}${room.equipment.length ? ` · ${room.equipment.join(", ")}` : ""}`,
      assignments: roomAssignments
        .filter((ra) => ra.roomId === room.id)
        .map((ra) => ({
          counsellorName: counsellors.find((c) => c.id === ra.counsellorId)?.name ?? "",
          days: ra.days,
          start: ra.start,
          end: ra.end,
        })),
      bookings: roomAppts
        .filter((a) => weekDates.some((d) => a.startsAt.startsWith(d)))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    });
  },

  listIntakeStatus: (orgId, now): Promise<IntakeStatusRow[]> => {
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const clients = liveOnly(allClients.filter((c) => c.orgId === orgId));
    return ok(
      clients.map((client) => {
        const appts = clientAppointments(client.id, now);
        const hasCompleted = appts.some((a) => a.state === "completed" || a.state === "discharged");
        const status: IntakeStatusRow["status"] = hasCompleted ? "completed" : appts.length > 0 ? "sent" : "not_sent";
        return {
          client,
          counsellorName: counsellors.find((c) => c.id === client.primaryCounsellorId)?.name ?? "Unassigned",
          status,
          sentAt: appts.length > 0 ? client.createdAt : null,
        };
      }),
    );
  },

  getIntakeBoard: (orgId, now): Promise<IntakeBoard> => {
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const clients = liveOnly(allClients.filter((c) => c.orgId === orgId));
    const nowMs = new Date(now).getTime();
    const rows = clients.map((client) => {
      const response = intakeResponses[client.id] ?? null;
      const appts = clientAppointments(client.id, now);
      const status: IntakeReviewRow["status"] = response ? "completed" : appts.length > 0 ? "sent" : "not_sent";
      return {
        client,
        counsellorName: counsellors.find((c) => c.id === client.primaryCounsellorId)?.name ?? "Unassigned",
        status,
        sentAt: appts.length > 0 || response ? client.createdAt : null,
        submittedAt: response ? new Date(nowMs - response.submittedDaysAgo * 86_400_000).toISOString() : null,
        answers: response?.answers ?? null,
      };
    });
    return ok({ form: intakeForms[orgId] ?? null, rows });
  },

  getIntakeForm: (orgId) => ok(intakeForms[orgId] ?? null),

  /* ── Forms library (Phase 18.6) ───────────────────────────────────────── */
  listForms: (orgId): Promise<FormSummary[]> => {
    const rows = mockForms
      .filter((f) => f.orgId === orgId)
      .map((f): FormSummary => {
        const sends = mockAssignments.filter((a) => a.formId === f.id && a.status !== "revoked");
        return {
          id: f.id, kind: f.kind, title: f.title, intro: f.intro, fieldCount: f.fields.length,
          status: f.status, sentCount: sends.length,
          completedCount: sends.filter((a) => a.status === "completed").length,
          updatedAt: f.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return ok(rows);
  },

  getForm: (orgId, formId) => ok(mockForms.find((f) => f.id === formId && f.orgId === orgId) ?? null),

  getFormResponses: (orgId, formId): Promise<FormResponses | null> => {
    const form = mockForms.find((f) => f.id === formId && f.orgId === orgId);
    if (!form) return ok(null);
    const counsellors = allCounsellors.filter((c) => c.orgId === orgId);
    const rows: FormResponseRow[] = mockAssignments
      .filter((a) => a.formId === formId && a.status !== "revoked")
      .map((a) => {
        const client = a.clientId ? allClients.find((c) => c.id === a.clientId) : undefined;
        return {
          assignmentId: a.id, clientId: a.clientId ?? "", clientName: client?.name ?? a.respondentName ?? "From share link",
          counsellorName: client ? (counsellors.find((c) => c.id === client.primaryCounsellorId)?.name ?? "Unassigned") : "Shared link",
          status: a.status, sentAt: a.sentAt, submittedAt: a.submittedAt, answers: a.answers, snapshot: a.snapshot,
        };
      })
      .sort((x, y) => (y.submittedAt ?? y.sentAt).localeCompare(x.submittedAt ?? x.sentAt));
    return ok({ form, rows });
  },

  createForm: (orgId, draft, createdBy, now) => {
    const id = newId("form");
    mockForms.push({ id, orgId, kind: draft.kind, title: draft.title, intro: draft.intro, fields: draft.fields, theme: draft.theme ?? null, status: "active", createdAt: now, updatedAt: now });
    return ok({ id });
  },

  updateForm: (orgId, formId, draft, now) => {
    const f = mockForms.find((x) => x.id === formId && x.orgId === orgId);
    if (!f) return ok({ ok: false });
    Object.assign(f, { kind: draft.kind, title: draft.title, intro: draft.intro, fields: draft.fields, theme: draft.theme ?? null, updatedAt: now });
    return ok({ ok: true });
  },

  duplicateForm: (orgId, formId, now) => {
    const f = mockForms.find((x) => x.id === formId && x.orgId === orgId);
    if (!f) return ok(null);
    const id = newId("form");
    mockForms.push({ id, orgId, kind: f.kind === "intake" ? "custom" : f.kind, title: `${f.title} (copy)`, intro: f.intro, fields: f.fields.map((x) => ({ ...x })), theme: f.theme ?? null, status: "active", createdAt: now, updatedAt: now });
    return ok({ id });
  },

  setFormShare: (orgId, formId, enabled, now) => {
    const f = mockForms.find((x) => x.id === formId && x.orgId === orgId);
    if (!f) return ok(null);
    f.shareToken = f.shareToken ?? (enabled ? `s_${newToken()}` : null);
    f.shareEnabled = enabled; f.updatedAt = now;
    return ok({ shareToken: f.shareToken ?? null, shareEnabled: enabled });
  },

  setFormStatus: (orgId, formId, status: FormStatus, now) => {
    const f = mockForms.find((x) => x.id === formId && x.orgId === orgId);
    if (!f) return ok({ ok: false });
    f.status = status; f.updatedAt = now;
    return ok({ ok: true });
  },

  sendFormToClients: (orgId, formId, clientIds, sentBy, now) => {
    const form = mockForms.find((f) => f.id === formId && f.orgId === orgId);
    if (!form) return ok({ sent: 0, assignments: [] });
    const snapshot = snapshotOf(form);
    const assignments = clientIds.map((clientId) => {
      // Reuse an existing un-submitted assignment (a resend) rather than duplicate.
      const existing = mockAssignments.find((a) => a.formId === formId && a.clientId === clientId && a.status === "sent");
      if (existing) {
        existing.snapshot = snapshot; existing.sentAt = now; existing.sentBy = sentBy;
        return { clientId, token: existing.token };
      }
      const token = newToken();
      mockAssignments.push({ id: newId("fa"), orgId, formId, clientId, token, status: "sent", snapshot, answers: null, sentBy, sentAt: now, submittedAt: null });
      return { clientId, token };
    });
    return ok({ sent: assignments.length, assignments });
  },

  getFormByToken: (token): Promise<FormTokenView | null> => {
    const a = mockAssignments.find((x) => x.token === token && x.status !== "revoked");
    if (a) {
      const org = orgs.find((o) => o.id === a.orgId);
      const form = mockForms.find((f) => f.id === a.formId);
      return ok({ assignmentId: a.id, formId: a.formId, orgId: a.orgId, orgName: org?.name ?? "Your practice", mode: "assignment", status: a.status, snapshot: a.snapshot, theme: form?.theme ?? null, submittedAt: a.submittedAt });
    }
    const f = mockForms.find((x) => x.shareToken === token && x.shareEnabled && x.status === "active");
    if (f) {
      const org = orgs.find((o) => o.id === f.orgId);
      return ok({ assignmentId: null, formId: f.id, orgId: f.orgId, orgName: org?.name ?? "Your practice", mode: "share", status: "sent", snapshot: snapshotOf(f), theme: f.theme ?? null, submittedAt: null });
    }
    return ok(null);
  },

  submitFormResponse: (token, answers, now) => {
    const a = mockAssignments.find((x) => x.token === token && x.status !== "revoked");
    if (a) {
      if (a.status === "completed") return ok({ ok: false as const, error: "This form has already been submitted." });
      a.answers = answers; a.status = "completed"; a.submittedAt = now;
      return ok({ ok: true as const });
    }
    const f = mockForms.find((x) => x.shareToken === token && x.shareEnabled && x.status === "active");
    if (!f) return ok({ ok: false as const, error: "This form link is no longer valid." });
    const nameField = f.fields.find((x) => /name/i.test(x.label) || /name/i.test(x.id));
    mockAssignments.push({ id: newId("fa"), orgId: f.orgId, formId: f.id, clientId: null, token: `r_${newToken()}`, status: "completed", snapshot: snapshotOf(f), answers, sentBy: null, sentAt: now, submittedAt: now, respondentName: (nameField ? answers[nameField.id] : "") || null });
    return ok({ ok: true as const });
  },

  listClientForms: (clientId): Promise<ClientFormRow[]> => {
    const rows = mockAssignments
      .filter((a) => a.clientId === clientId && a.status !== "revoked")
      .map((a): ClientFormRow => ({ assignmentId: a.id, token: a.token, formTitle: a.snapshot.title, kind: a.snapshot.kind, status: a.status, sentAt: a.sentAt, submittedAt: a.submittedAt }))
      .sort((x, y) => y.sentAt.localeCompare(x.sentAt));
    return ok(rows);
  },

  listOrgInvoices: (orgId) => ok(orgInvoicesFor(orgId)),

  getReporting: (orgId, now, filters): Promise<ReportingResult> => {
    const clients = liveOnly(allClients.filter((c) => c.orgId === orgId));
    const consented = clients.filter((c) => consentActiveFor(c.id, "demographics"));
    let demos = consented
      .map((c) => allDemographics.find((d) => d.clientId === c.id))
      .filter((d): d is Demographics => Boolean(d));

    if (filters.province) demos = demos.filter((d) => d.province === filters.province);
    if (filters.gender) demos = demos.filter((d) => d.gender === filters.gender);
    if (filters.ageBand) demos = demos.filter((d) => d.ageBand === filters.ageBand);
    if (filters.employment) demos = demos.filter((d) => d.employmentStatus === filters.employment);

    // Aggregate PHQ-9 trend across consented clients (org-wide outcome).
    const buckets = new Map<number, number[]>();
    for (const c of consented) {
      for (const o of clientOutcomes[c.id] ?? []) {
        if (o.tool !== "PHQ-9") continue;
        const arr = buckets.get(o.weeksAgo) ?? [];
        arr.push(o.score);
        buckets.set(o.weeksAgo, arr);
      }
    }
    const points: OutcomePoint[] = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([w, scores]) => ({
        label: w === 0 ? "now" : `${w}w`,
        value: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
      }));
    const measured = consented.filter((c) => (clientOutcomes[c.id]?.length ?? 0) > 0).length;

    return ok({
      totalClients: clients.length,
      withDemographics: consented.length,
      matched: demos.length,
      byProvince: toBreakdown(countBy(demos, (d) => d.province)),
      byGender: toBreakdown(countBy(demos, (d) => GENDER_LABELS[d.gender])),
      byPopulationGroup: toBreakdown(countBy(demos, (d) => POPULATION_GROUP_LABELS[d.populationGroup])),
      byAgeBand: toBreakdown(countBy(demos, (d) => AGE_BAND_LABELS[d.ageBand])),
      byEmployment: toBreakdown(countBy(demos, (d) => EMPLOYMENT_LABELS[d.employmentStatus])),
      outcome: { points, coverage: { captured: measured, total: consented.length } },
    });
  },

  getOrgSettings: (orgId) => {
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return ok(null);
    // Dormant by default  no gateway connected until an admin configures one.
    return ok({ org, paymentProvider: null, paymentStatus: "off" as const });
  },

  // ---- Funders & grants (M&E) -----------------------------------------
  listFunders: (orgId) => ok(funders.filter((f) => f.orgId === orgId)),

  listGrants: (orgId): Promise<GrantSummary[]> =>
    ok(
      grants
        .filter((g) => g.orgId === orgId)
        .map((grant) => ({
          grant,
          funder: funders.find((f) => f.id === grant.funderId)!,
          indicatorCount: grantIndicators.filter((i) => i.grantId === grant.id).length,
          allocatedCount: allocatedClientsFor(grant.id).length,
        })),
    ),

  getGrantView: (orgId, grantId, now): Promise<GrantView | null> => {
    const grant = grants.find((g) => g.id === grantId && g.orgId === orgId);
    if (!grant) return ok(null);
    const funder = funders.find((f) => f.id === grant.funderId);
    if (!funder) return ok(null);
    const clients = allocatedClientsFor(grant.id);
    const consented = clients.filter((c) => consentActiveFor(c.id, "demographics"));
    return ok({
      grant,
      funder,
      indicators: grantIndicators.filter((i) => i.grantId === grant.id).map((i) => computeIndicator(i, grant, now)),
      allocatedCount: clients.length,
      withDemographics: consented.length,
      periodElapsedPct: Math.round(periodElapsed(grant, now) * 100),
      breakdowns: grantBreakdowns(grant.id),
      outcome: grantOutcome(grant.id, now),
      narratives: grantNarratives.filter((n) => n.grantId === grant.id).sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    });
  },

  getGrantAdmin: (orgId, grantId) => {
    const grant = grants.find((g) => g.id === grantId && g.orgId === orgId);
    if (!grant) return ok(null);
    return ok({
      indicators: grantIndicators.filter((i) => i.grantId === grantId),
      allocatedClientIds: [...new Set(grantAllocations.filter((a) => a.grantId === grantId).map((a) => a.clientId))],
    });
  },

  listFunderGrants: (funderUserId) => {
    const scoped = funderContacts.filter((fc) => fc.userId === funderUserId);
    const grantIds = new Set(scoped.flatMap((fc) => fc.grantIds));
    return ok(
      grants
        .filter((g) => grantIds.has(g.id))
        .map((grant) => ({
          grant,
          funderName: funders.find((f) => f.id === grant.funderId)?.name ?? "",
          orgName: orgs.find((o) => o.id === grant.orgId)?.name ?? "",
        })),
    );
  },

  getFunderGrantView: (funderUserId, grantId, now): Promise<FunderGrantView | null> => {
    // Scope check  a funder reaches ONLY their grant(s) (requireFunderGrant).
    const scoped = funderContacts.some((fc) => fc.userId === funderUserId && fc.grantIds.includes(grantId));
    if (!scoped) return ok(null);
    const grant = grants.find((g) => g.id === grantId);
    if (!grant) return ok(null);
    const funder = funders.find((f) => f.id === grant.funderId);
    return ok({
      grant,
      funderName: funder?.name ?? "",
      orgName: orgs.find((o) => o.id === grant.orgId)?.name ?? "",
      indicators: grantIndicators.filter((i) => i.grantId === grant.id).map((i) => computeIndicator(i, grant, now)),
      periodElapsedPct: Math.round(periodElapsed(grant, now) * 100),
      breakdowns: grantBreakdowns(grant.id),
      outcome: grantOutcome(grant.id, now),
      narratives: grantNarratives.filter((n) => n.grantId === grant.id).sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    });
  },

  // ---- Platform (super-admin) -----------------------------------------
  getPlatformOverview: (): Promise<PlatformOverview> => {
    const planPrice = (planId: string) => plans.find((p) => p.id === planId)?.priceCents ?? 0;
    const health = { live: 0, mock: 0, off: 0 };
    for (const i of integrationsCatalogue) health[i.status]++;
    return ok({
      orgCount: platformOrgs.length,
      activeOrgs: platformOrgs.filter((o) => o.subscriptionStatus === "active").length,
      trialingOrgs: platformOrgs.filter((o) => o.subscriptionStatus === "trialing").length,
      suspendedOrgs: platformOrgs.filter((o) => o.suspended).length,
      totalMembers: platformOrgs.reduce((s, o) => s + o.members, 0),
      sessions7d: platformOrgs.reduce((s, o) => s + o.sessions7d, 0),
      aiSpendCents: platformOrgs.reduce((s, o) => s + o.aiSpendCents, 0),
      mrrCents: platformOrgs
        .filter((o) => o.subscriptionStatus === "active")
        .reduce((s, o) => s + planPrice(o.planId), 0),
      integrationHealth: health,
    });
  },

  listPlatformOrgs: (): Promise<PlatformOrgRow[]> =>
    ok(
      platformOrgs.map((org) => {
        const plan = plans.find((p) => p.id === org.planId);
        return { org, planName: plan?.name ?? "", planPriceCents: plan?.priceCents ?? 0 };
      }),
    ),

  listOnboardingRequirements: () => ok(onboardingRequirements),

  getOrgOnboardingReview: (orgId): Promise<OrgOnboardingReview> => {
    const submitted = orgOnboardingDocs[orgId] ?? {};
    const docs = onboardingRequirements.map((req) => {
      const s = submitted[req.id];
      return {
        requirementId: req.id,
        label: req.label,
        required: req.required,
        status: (s?.status ?? "missing") as OnboardingDocStatus,
        fileName: s?.fileName ?? null,
        uploadedAt: s ? new Date(Date.now() - s.daysAgo * 86_400_000).toISOString() : null,
      };
    });
    const required = docs.filter((d) => d.required);
    const actionNeeded = docs.some((d) => d.status === "rejected") || required.some((d) => d.status === "missing");
    const allVerified = required.every((d) => d.status === "verified");
    const verification = actionNeeded ? "action_needed" : allVerified ? "verified" : "pending";
    return ok({ docs, verification });
  },

  getPlatformOrgDetail: (orgId) => {
    const org = platformOrgs.find((o) => o.id === orgId);
    if (!org) return ok(null);
    const plan = plans.find((p) => p.id === org.planId);
    // Only the seeded org (Masizakhe) has a full member + client directory.
    const fullyModeled = orgId === "org_masizakhe";
    const team = fullyModeled
      ? teamMembers.map((m) => {
          const counsellor = m.counsellorId ? allCounsellors.find((c) => c.id === m.counsellorId) : undefined;
          return {
            userId: m.userId,
            name: m.name,
            email: m.email,
            teamRole: m.teamRole,
            isSupervisor: m.isSupervisor,
            active: m.active,
            credential: counsellor ? { body: counsellor.credential.body, status: counsellor.credential.status } : null,
            joinedAt: m.joinedAt,
          };
        })
      : [];
    const clientCount = fullyModeled ? liveOnly(allClients.filter((c) => c.orgId === orgId)).length : 0;
    return ok({ org, planName: plan?.name ?? "", planPriceCents: plan?.priceCents ?? 0, team, clientCount, fullyModeled });
  },

  listPlans: (): Promise<PlanWithUsage[]> =>
    ok(
      plans.map((plan) => {
        const subs = platformOrgs.filter((o) => o.planId === plan.id && o.subscriptionStatus === "active");
        return { plan, subscribers: subs.length, mrrCents: subs.length * plan.priceCents };
      }),
    ),

  getAiRail: () => ok(aiRailConfig),
  listIntegrations: () => ok(integrationsCatalogue),
  listPlatformAudit: () => ok([...platformAuditEvents].sort((a, b) => b.at.localeCompare(a.at))),
};

/* ---- The grant-indicator engine (actuals auto-computed, never typed) -- */

function allocatedClientsFor(grantId: string): Client[] {
  const ids = new Set(grantAllocations.filter((a) => a.grantId === grantId).map((a) => a.clientId));
  return liveOnly(allClients.filter((c) => ids.has(c.id)));
}

function periodElapsed(grant: Grant, nowISO: string): number {
  const start = new Date(`${grant.periodStart}T00:00:00Z`).getTime();
  const end = new Date(`${grant.periodEnd}T23:59:59Z`).getTime();
  const t = new Date(nowISO).getTime();
  if (t <= start || end <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function consentedDemosFor(clients: Client[]): Demographics[] {
  return clients
    .filter((c) => consentActiveFor(c.id, "demographics"))
    .map((c) => allDemographics.find((d) => d.clientId === c.id))
    .filter((d): d is Demographics => Boolean(d));
}

function computeIndicator(ind: GrantIndicator, grant: Grant, now: string): IndicatorActual {
  const clients = allocatedClientsFor(grant.id);
  const demos = consentedDemosFor(clients);
  let actual = 0;

  switch (ind.metric) {
    case "unique_clients":
      actual = clients.length;
      break;
    case "sessions_delivered":
      actual = clients.reduce(
        (s, c) =>
          s +
          clientAppointments(c.id, now).filter((a) => {
            const d = a.startsAt.slice(0, 10);
            return (
              ["completed", "discharged"].includes(a.state) && d >= grant.periodStart && d <= grant.periodEnd
            );
          }).length,
        0,
      );
      break;
    case "pct_female":
      actual = pct(demos.filter((d) => d.gender === "female").length, demos.length);
      break;
    case "pct_employed":
      actual = pct(demos.filter((d) => d.employmentStatus === "employed").length, demos.length);
      break;
    case "pct_youth":
      actual = pct(demos.filter((d) => ["under_18", "18_24"].includes(d.ageBand)).length, demos.length);
      break;
    case "phq9_improved_5": {
      const series = clients
        .map((c) => (clientOutcomes[c.id] ?? []).filter((o) => o.tool === "PHQ-9"))
        .filter((arr) => arr.length >= 2);
      const improved = series.filter((arr) => {
        const byOldest = [...arr].sort((a, b) => b.weeksAgo - a.weeksAgo);
        const first = byOldest[0]!.score;
        const last = byOldest[byOldest.length - 1]!.score;
        return first - last >= 5;
      });
      actual = pct(improved.length, series.length);
      break;
    }
  }

  const isCount = ind.type === "count";
  const elapsed = periodElapsed(grant, now);
  const expected = isCount ? Math.round(ind.target * elapsed) : null;
  const ratio = isCount
    ? expected && expected > 0
      ? actual / expected
      : actual >= ind.target
        ? 1
        : 0
    : ind.target > 0
      ? actual / ind.target
      : 1;
  const status: IndicatorStatus = ratio >= 0.9 ? "on_track" : ratio >= 0.7 ? "at_risk" : "behind";
  return { indicator: ind, actual, expected, status };
}

function grantBreakdowns(grantId: string): GrantBreakdowns {
  const demos = consentedDemosFor(allocatedClientsFor(grantId));
  return {
    byGender: toBreakdown(countBy(demos, (d) => GENDER_LABELS[d.gender])),
    byAgeBand: toBreakdown(countBy(demos, (d) => AGE_BAND_LABELS[d.ageBand])),
    byProvince: toBreakdown(countBy(demos, (d) => d.province)),
  };
}

function grantOutcome(grantId: string, now: string): { points: OutcomePoint[]; coverage: { captured: number; total: number } } {
  const clients = allocatedClientsFor(grantId);
  const buckets = new Map<number, number[]>();
  for (const c of clients) {
    if (!consentActiveFor(c.id, "demographics")) continue;
    for (const o of clientOutcomes[c.id] ?? []) {
      if (o.tool !== "PHQ-9") continue;
      const arr = buckets.get(o.weeksAgo) ?? [];
      arr.push(o.score);
      buckets.set(o.weeksAgo, arr);
    }
  }
  void now;
  const points: OutcomePoint[] = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, scores]) => ({ label: w === 0 ? "now" : `${w}w`, value: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) }));
  const measured = clients.filter((c) => (clientOutcomes[c.id]?.length ?? 0) > 0).length;
  return { points, coverage: { captured: measured, total: clients.length } };
}

function filterRange(appts: Appointment[], opts?: { from?: string; to?: string }): Appointment[] {
  if (!opts?.from && !opts?.to) return appts;
  return appts.filter((a) => {
    const d = a.startsAt.slice(0, 10);
    if (opts.from && d < opts.from.slice(0, 10)) return false;
    if (opts.to && d > opts.to.slice(0, 10)) return false;
    return true;
  });
}

function buildAttention(
  todays: AppointmentView[],
  week: Appointment[],
): CounsellorDashboard["attention"] {
  const items: CounsellorDashboard["attention"] = [];

  for (const a of todays) {
    if (a.state === "risk_flagged") {
      items.push({
        id: `risk_${a.id}`,
        tone: "rose",
        title: `Safeguarding flag  ${a.clientName}`,
        // Points to a human + a current SA resource; never names a method (Rule #8).
        detail: "Review with your supervisor. SADAG crisis line: 0800 567 567 (or SMS 31393).",
        href: `/app/sessions/${a.id}`,
      });
    }
  }

  const missed = week.find((a) => a.state === "no_show");
  if (missed) {
    items.push({
      id: `missed_${missed.id}`,
      tone: "amber",
      title: "Missed session to follow up",
      detail: "A client did not attend this week  reach out to rebook.",
    });
  }

  return items;
}

/* Re-export entity types for convenience at call sites. */
export type { Appointment, Client, Counsellor, Org, Room, Service };
