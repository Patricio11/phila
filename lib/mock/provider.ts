/**
 * mockProvider — the Part-A implementation of the `dataProvider` seam. It reads
 * typed fixtures and materialises a live week of appointments around "now", so
 * the demo is always populated and behaves like production. It is consent- and
 * redaction-aware: it never returns demographics without an active consent, and
 * the private note is a different path from the shared care plan.
 */
import type {
  AppointmentView,
  CaseloadRow,
  CaseloadStatus,
  CounsellorDashboard,
  DataProvider,
} from "@/lib/data-provider";
import type {
  Appointment,
  Client,
  Counsellor,
  Org,
  OutcomeMeasure,
  Room,
  Service,
  SessionNote,
} from "@/lib/mock/types";
import {
  carePlans,
  clientApptTemplates,
  clientDocuments,
  clientOutcomes,
  clients as allClients,
  consents as allConsents,
  counsellorDayTemplates,
  counsellors as allCounsellors,
  demographics as allDemographics,
  intakeForms,
  invoices as allInvoices,
  orgPublicContent,
  orgs,
  outcomeSeries,
  rooms as allRooms,
  services as allServices,
  sites as allSites,
  supervisionTemplates,
} from "@/lib/mock/fixtures";
import { isConsentActive } from "@/lib/consent";
import { liveOnly } from "@/lib/retention";
import { SAST_OFFSET } from "@/lib/mock/helpers";
import type { ConsentPurpose } from "@/lib/domain/enums";

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

/** A client's sessions — their own template if present, else derived from the counsellors'. */
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
      body: "Client presented low and withdrawn; spoke about feeling overwhelmed at home. A safeguarding concern came up — stayed with it, agreed a follow-up within the week, and shared current support. To review with supervisor.",
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
    return ok({
      appointment: toView(appt),
      client,
      demographicsConsented: consentActiveFor(appt.clientId, "demographics"),
      note: seedNote(appt),
      carePlan: carePlans[appt.clientId] ?? null,
      outcomes: materialiseOutcomes(appt.clientId, now),
    });
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
};

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
        title: `Safeguarding flag — ${a.clientName}`,
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
      detail: "A client did not attend this week — reach out to rebook.",
    });
  }

  return items;
}

/* Re-export entity types for convenience at call sites. */
export type { Appointment, Client, Counsellor, Org, Room, Service };
