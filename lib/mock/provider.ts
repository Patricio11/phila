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
  Breakdown,
  CaseloadRow,
  CaseloadStatus,
  Conversation,
  CounsellorDashboard,
  CounsellorRoomsView,
  DataProvider,
  FunderGrantView,
  GrantBreakdowns,
  GrantSummary,
  GrantView,
  HubOverview,
  IndicatorActual,
  IndicatorStatus,
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
  TeamMemberDetail,
  TeamMemberView,
} from "@/lib/data-provider";
import type {
  Appointment,
  Client,
  Counsellor,
  Demographics,
  Grant,
  GrantIndicator,
  Invoice,
  Org,
  OutcomeMeasure,
  Room,
  Service,
  SessionNote,
} from "@/lib/mock/types";
import {
  aiRailConfig,
  carePlans,
  clientApptTemplates,
  clientDocuments,
  clientOutcomes,
  clients as allClients,
  consents as allConsents,
  conversations,
  integrationsCatalogue,
  plans,
  platformAuditEvents,
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
} from "@/lib/mock/fixtures";
import { isConsentActive } from "@/lib/consent";
import { liveOnly } from "@/lib/retention";
import { applyKAnon, isoWeekday, roomUtilisation, SAST_OFFSET } from "@/lib/mock/helpers";
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
    return ok({
      org,
      services: allServices.filter((s) => s.orgId === org.id),
      counsellors: allCounsellors.filter((c) => c.orgId === org.id),
      intakeForm,
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

  async getCounsellorDashboard(counsellorId, now): Promise<CounsellorDashboard | null> {
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

  listAppointmentsForClient: (clientId, now) =>
    ok(
      materialiseClient(clientId, now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(toView),
    ),

  getCarePlan: (clientId) => ok(carePlans[clientId] ?? null),
  listClientDocuments: (clientId) => ok(clientDocuments[clientId] ?? []),
  listClientInvoices: (clientId) => ok(allInvoices[clientId] ?? []),
  getClientConsents: (clientId) => ok(allConsents.filter((c) => c.clientId === clientId)),

  // ---- Counsellor workspace -------------------------------------------
  listCaseload: (counsellorId, now) => {
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

  getClientDossier: (clientId, now) => {
    const client = allClients.find((c) => c.id === clientId);
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

  listCounsellorSessions: (counsellorId, now) =>
    ok(
      materialise(counsellorId, now)
        .map(toView)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    ),

  getSession: (appointmentId, now) => {
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
        };
      });
    return ok(items);
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
    const incomeMonthCents = invoices
      .filter((i) => i.status === "paid" && i.issuedAt.startsWith(month))
      .reduce((s, i) => s + i.amountCents, 0);
    const futureMonth = appts.filter(
      (a) => a.startsAt.startsWith(month) && new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled",
    );
    const incomePredictionCents =
      incomeMonthCents +
      futureMonth.reduce((s, a) => s + (allServices.find((x) => x.id === a.serviceId)?.priceCents ?? 0), 0);

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
      incomeMonthCents,
      incomePredictionCents,
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

  getRoomDetail: (roomId, now): Promise<RoomDetail | null> => {
    const room = allRooms.find((r) => r.id === roomId);
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

  getGrantView: (grantId, now): Promise<GrantView | null> => {
    const grant = grants.find((g) => g.id === grantId);
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
