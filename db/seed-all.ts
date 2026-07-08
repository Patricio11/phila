/**
 * Seed EVERYTHING from the fixtures into the live DB (Phase 10)  production-real,
 * nothing forgotten. Reads the same `lib/mock/fixtures` the mock provider uses, so
 * the DB mirrors Part A exactly and the hybrid provider's mock fallback == real
 * reads. Idempotent (ON CONFLICT DO NOTHING). Grows cluster-by-cluster.
 *
 *   npm run db:seed        (→ tsx db/seed-all.ts)
 *
 * Every demo account signs in with the password below (see docs/DEMO_LOGINS.md).
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, gte, lte } from "drizzle-orm";
import { createCipheriv, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import * as schema from "@/db/schema";
import {
  orgs as orgFx,
  counsellors as counsellorsFx,
  services as servicesFx,
  sites as sitesFx,
  rooms as roomsFx,
  roomAssignments as roomAssignmentsFx,
  clients as clientsFx,
  demographics as demographicsFx,
  consents as consentsFx,
  counsellorDayTemplates as dayTemplates,
  carePlans as carePlansFx,
  clientDocuments as docsFx,
  clientOutcomes as outcomesFx,
  invoices as invoicesFx,
  orgExtraInvoices as extraInvoicesFx,
  funders as fundersFx,
  grants as grantsFx,
  grantIndicators as indicatorsFx,
  grantAllocations as allocationsFx,
  grantNarratives as narrativesFx,
  funderContacts as funderContactsFx,
  teamThreads as teamThreadsFx,
  supervisionTemplates as supervisionFx,
  orgForms as orgFormsFx,
  formAssignments as formAssignmentsFx,
  bookingSettings as bookingSettingsFx,
  platformSettings as platformSettingsFx,
  onboardingRequirements as onboardingReqFx,
  orgOnboardingDocs as onboardingDocsFx,
} from "@/lib/mock/fixtures";
import { CHANNELS, TRIGGERS, DEFAULT_TEMPLATES } from "@/lib/messaging/templates";
import { PLANS } from "@/lib/billing/plans";

/** SAST calendar-day for an instant (fixed +02:00, no DST). */
function sastDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Field encryption matching lib/crypto (server-only, can't be imported in tsx). */
function encField(plaintext: string): string {
  const key = Buffer.from(process.env.PHILA_FIELD_KEY ?? "", "base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const db = drizzle(neon(url), { schema });

const PASSWORD = "phila1234";
const ORG = "org_masizakhe";

const DEMO_USERS = [
  { id: "user_nomsa", name: "Nomsa Dlamini", email: "nomsa@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_thabo", name: "Thabo Mokoena", email: "thabo@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_aisha", name: "Aisha Patel", email: "aisha@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_pieter", name: "Pieter van der Merwe", email: "pieter@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_thandeka", name: "Thandeka Mbeki", email: "thandeka@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_lindiwe", name: "Lindiwe Khoza", email: "frontdesk@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_riaan", name: "Riaan Steyn", email: "finance@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_bongani", name: "Bongani Nkosi", email: "programmes@masizakhe.org.za", platformRole: null, clientId: null },
  { id: "user_lerato", name: "Lerato Mahlangu", email: "lerato.m@example.co.za", platformRole: "client", clientId: "cl_lerato" },
  { id: "user_funder", name: "Palesa Mokoena", email: "palesa.mokoena@dsd.example.gov.za", platformRole: "funder", clientId: null },
  { id: "user_operator", name: "Sizwe Ndlovu", email: "ops@philasa.com", platformRole: "super_admin", clientId: null },
];

const MEMBERS = [
  { userId: "user_nomsa", teamRole: "counsellor", isSupervisor: true, status: "active" },
  { userId: "user_thabo", teamRole: "counsellor", isSupervisor: false, status: "active" },
  { userId: "user_aisha", teamRole: "counsellor", isSupervisor: false, status: "active" },
  { userId: "user_pieter", teamRole: "counsellor", isSupervisor: false, status: "active" },
  { userId: "user_thandeka", teamRole: "org_admin", isSupervisor: false, status: "active" },
  { userId: "user_lindiwe", teamRole: "front_desk", isSupervisor: false, status: "active" },
  { userId: "user_riaan", teamRole: "finance", isSupervisor: false, status: "active" },
  { userId: "user_bongani", teamRole: "programme_manager", isSupervisor: false, status: "archived" },
] as const;

async function main() {
  const hash = await hashPassword(PASSWORD);
  const now = new Date();

  // ── Org (with display + config from the fixture) ──────────────────────
  const org = orgFx[0]!;
  await db.insert(schema.orgs).values({
    id: org.id,
    name: org.name,
    slug: org.slug,
    province: org.province,
    brandAccent: org.brandAccent,
    timezone: org.timezone,
    features: org.features as Record<string, boolean>,
    scheduling: org.scheduling as unknown as Record<string, unknown>,
    clientPortal: org.clientPortal as unknown as Record<string, boolean>,
    bookingSettings: (bookingSettingsFx[org.id] ?? {}) as unknown as Record<string, unknown>,
    onboardingStatus: "verified", // the established demo practice is fully verified
    createdAt: now,
  }).onConflictDoNothing();

  // ── Platform config (super-admin): national VAT rate ──────────────────
  await db.insert(schema.platformSettings).values({ id: "global", vatRatePercent: platformSettingsFx.vatRatePercent }).onConflictDoNothing();

  // ── Identity (users + credentials + memberships) ──────────────────────
  for (const u of DEMO_USERS) {
    await db.insert(schema.user).values({ id: u.id, name: u.name, email: u.email, emailVerified: true, createdAt: now, updatedAt: now, platformRole: u.platformRole, clientId: u.clientId }).onConflictDoNothing();
    await db.insert(schema.account).values({ id: `acct_${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: hash, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }
  for (const m of MEMBERS) {
    await db.insert(schema.orgMembers).values({ orgId: ORG, userId: m.userId, teamRole: m.teamRole, isSupervisor: m.isSupervisor, status: m.status, createdAt: now }).onConflictDoNothing();
  }

  // ── Directory cluster ─────────────────────────────────────────────────
  for (const c of counsellorsFx) {
    await db.insert(schema.counsellors).values({
      id: c.id, userId: c.userId, orgId: c.orgId, name: c.name,
      credentialBody: c.credential.body, credentialRegNo: c.credential.registrationNo ?? null, credentialStatus: c.credential.status,
      isSupervisor: c.isSupervisor, supervisorId: c.supervisorId,
    }).onConflictDoNothing();
  }
  for (const s of servicesFx) {
    await db.insert(schema.services).values({ id: s.id, orgId: s.orgId, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }).onConflictDoNothing();
  }
  for (const s of sitesFx) {
    await db.insert(schema.sites).values({ id: s.id, orgId: s.orgId, name: s.name, province: s.province }).onConflictDoNothing();
  }
  for (const r of roomsFx) {
    await db.insert(schema.rooms).values({ id: r.id, orgId: r.orgId, siteId: r.siteId, name: r.name, capacity: r.capacity, equipment: r.equipment, status: r.status, colour: r.colour }).onConflictDoNothing();
  }
  for (const ra of roomAssignmentsFx) {
    const orgId = roomsFx.find((r) => r.id === ra.roomId)?.orgId;
    if (!orgId) continue;
    await db.insert(schema.roomAssignments).values({ id: ra.id, orgId, counsellorId: ra.counsellorId, roomId: ra.roomId, days: ra.days, start: ra.start, end: ra.end }).onConflictDoNothing();
  }
  for (const c of clientsFx) {
    await db.insert(schema.clients).values({
      id: c.id, orgId: c.orgId, name: c.name, phone: c.phone ?? null, email: c.email ?? null, province: c.province,
      primaryCounsellorId: c.primaryCounsellorId, riskFlag: c.riskFlag, createdAt: new Date(c.createdAt), deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
    }).onConflictDoNothing();
  }
  for (const d of demographicsFx) {
    await db.insert(schema.demographics).values({ clientId: d.clientId, gender: d.gender, populationGroup: d.populationGroup, employmentStatus: d.employmentStatus, ageBand: d.ageBand, province: d.province }).onConflictDoNothing();
  }

  // ── Consent (versioned, purpose-bound) ────────────────────────────────
  for (const c of consentsFx) {
    await db.insert(schema.consents).values({ orgId: ORG, clientId: c.clientId, purpose: c.purpose, state: c.state, version: c.version, updatedAt: new Date(c.updatedAt) }).onConflictDoNothing();
  }

  // ── Appointments  materialised around NOW from the day templates, so the
  //    demo always has a live week. Refreshed each seed (delete the templated
  //    rows; real client bookings are left untouched).
  const durationOf = new Map(servicesFx.map((s) => [s.id, s.durationMin]));
  const today = sastDate(now);
  // Clear the org's "live week" first (templates + supervision land here). This drops any
  // stale rows — old templated sessions AND residue left by test runs sharing a room — so
  // the rebuild never trips the room/counsellor overlap constraint. Cohort history (older,
  // and online) and other tenants are untouched; a fresh prod DB has nothing to clear.
  await db.delete(schema.appointments).where(and(
    eq(schema.appointments.orgId, ORG),
    gte(schema.appointments.startsAt, new Date(`${addDays(today, -9)}T00:00:00+02:00`)),
    lte(schema.appointments.startsAt, new Date(`${addDays(today, 3)}T23:59:59+02:00`)),
  ));
  for (const [cid, template] of Object.entries(dayTemplates)) {
    for (let i = 0; i < template.length; i++) await db.delete(schema.appointments).where(eq(schema.appointments.id, `appt_${cid}_${i}`));
    await db.insert(schema.appointments).values(
      template.map((e, i) => ({
        id: `appt_${cid}_${i}`,
        orgId: ORG,
        clientId: e.clientId,
        counsellorId: cid,
        serviceId: e.serviceId,
        type: e.type,
        roomId: e.roomId,
        startsAt: new Date(`${addDays(today, e.dayOffset)}T${e.time}:00+02:00`),
        durationMin: durationOf.get(e.serviceId) ?? 60,
        state: e.state,
        tags: e.tags ?? [],
      })),
    );
  }
  // An upcoming online session for the demo client (Lerato) so the portal's next-session
  // card + the "request to reschedule/cancel" flow are demonstrable. Nomsa is free at +2.
  await db.insert(schema.appointments).values({
    id: "appt_lerato_upcoming", orgId: ORG, clientId: "cl_lerato", counsellorId: "couns_nomsa", serviceId: "svc_individual",
    type: "online", roomId: null, startsAt: new Date(`${addDays(today, 2)}T10:00:00+02:00`), durationMin: 60, state: "scheduled", tags: [],
  }).onConflictDoNothing({ target: schema.appointments.id });

  // ── Clinical cluster ──────────────────────────────────────────────────
  for (const plan of Object.values(carePlansFx)) {
    await db.insert(schema.carePlans).values({
      id: plan.id, clientId: plan.clientId, authorCounsellorId: plan.authorCounsellorId, summary: plan.summary,
      tasks: plan.tasks, resources: plan.resources, nextStep: plan.nextStep, sharedAt: plan.sharedAt ? new Date(plan.sharedAt) : null,
    }).onConflictDoNothing();
  }
  for (const docs of Object.values(docsFx)) {
    for (const d of docs) {
      await db.insert(schema.clientDocuments).values({ id: d.id, clientId: d.clientId, orgId: d.orgId, name: d.name, kind: d.kind, sizeLabel: d.sizeLabel, sharedBy: d.sharedBy, createdAt: new Date(d.createdAt) }).onConflictDoNothing();
    }
  }

  // ── Documents cluster (Phase 18) ──────────────────────────────────────
  // Generalized `documents` (mirror legacy client_documents; client-visible + already scanned).
  for (const docs of Object.values(docsFx)) {
    for (const d of docs) {
      await db.insert(schema.documents).values({
        id: d.id, orgId: d.orgId, clientId: d.clientId, name: d.name, kind: d.kind,
        visibility: "client_visible", storageProvider: "supabase", sizeLabel: d.sizeLabel,
        scanStatus: "clean", sharedBy: d.sharedBy, bytes: 0, createdAt: new Date(d.createdAt),
      }).onConflictDoNothing();
    }
  }
  // Starter folders + a storage-usage row for the demo org.
  await db.insert(schema.documentFolders).values([
    { id: "fold_mas_reports", orgId: "org_masizakhe", name: "Reports", scope: "org", createdAt: now },
    { id: "fold_mas_templates", orgId: "org_masizakhe", name: "Policies & templates", scope: "org", createdAt: now },
  ]).onConflictDoNothing();
  await db.insert(schema.orgStorageUsage).values({ orgId: "org_masizakhe", bytesUsed: 0, updatedAt: now }).onConflictDoNothing();
  // A sample open request from the practice to a client (the gate for client uploads).
  const firstDocClient = Object.values(docsFx)[0]?.[0]?.clientId;
  if (firstDocClient) {
    await db.insert(schema.documentRequests).values({
      id: "docreq_seed_1", orgId: "org_masizakhe", clientId: firstDocClient, requestedBy: "system",
      title: "Copy of your ID", note: "A clear photo of your green ID book or smart ID card.",
      status: "pending", createdAt: now,
    }).onConflictDoNothing();
  }
  // Org→counsellor shares so each counsellor's "Shared with me" reads true. The admin
  // shares the Reports folder with the team and a specific file with one counsellor.
  const DOC_SHARES = [
    { id: "dshare_reports_thabo", targetType: "folder", targetId: "fold_mas_reports", sharedWith: "user_thabo" },
    { id: "dshare_reports_aisha", targetType: "folder", targetId: "fold_mas_reports", sharedWith: "user_aisha" },
    { id: "dshare_reports_pieter", targetType: "folder", targetId: "fold_mas_reports", sharedWith: "user_pieter" },
    { id: "dshare_doc1_thabo", targetType: "file", targetId: "doc1", sharedWith: "user_thabo" },
  ] as const;
  for (const s of DOC_SHARES) {
    await db.insert(schema.documentShares).values({
      id: s.id, orgId: "org_masizakhe", targetType: s.targetType, targetId: s.targetId,
      sharedWith: s.sharedWith, grantedBy: "user_thandeka", createdAt: now,
    }).onConflictDoNothing();
  }

  for (const [clientId, measures] of Object.entries(outcomesFx)) {
    for (let i = 0; i < measures.length; i++) {
      const m = measures[i]!;
      await db.insert(schema.outcomeMeasures).values({ id: `om_${clientId}_${i}`, clientId, tool: m.tool, score: m.score, takenAt: new Date(now.getTime() - m.weeksAgo * 7 * 86_400_000) }).onConflictDoNothing();
    }
  }

  // ── Supervision cluster ───────────────────────────────────────────────
  // Signed supervisee notes awaiting the supervisor's sign-off, each on a real
  // backing appointment (16:00+, clear of the day templates). Drives the hub's
  // supervision queue + each counsellor's note history. Supervisor = nomsa.
  const supervisorOf = new Map(counsellorsFx.map((c) => [c.id, c.supervisorId]));
  for (let i = 0; i < supervisionFx.length; i++) {
    const s = supervisionFx[i]!;
    const apptId = `appt_sup_${i}`;
    const startsAt = new Date(`${addDays(today, s.sessionDayOffset)}T16:${String((i % 2) * 30).padStart(2, "0")}:00+02:00`);
    await db.delete(schema.appointments).where(eq(schema.appointments.id, apptId));
    await db.insert(schema.appointments).values({
      id: apptId, orgId: ORG, clientId: s.clientId, counsellorId: s.superviseeId, serviceId: s.serviceId,
      type: "in_person", roomId: null, startsAt, durationMin: durationOf.get(s.serviceId) ?? 60, state: "completed", tags: [],
    }).onConflictDoNothing({ target: schema.appointments.id });
    await db.insert(schema.sessionNotes).values({
      id: `sn_sup_${i}`, appointmentId: apptId, authorCounsellorId: s.superviseeId, body: s.note,
      aiGenerated: s.aiGenerated, signedAt: new Date(now.getTime() + s.submittedDayOffset * 86_400_000),
      supervisorId: supervisorOf.get(s.superviseeId) ?? "couns_nomsa", supervisorSignedAt: null, supervisorDecision: null, supervisorComment: null,
    }).onConflictDoNothing();
  }

  // ── Forms cluster (Phase 18.6) ────────────────────────────────────────
  // The org's forms library + the forms already sent to clients (the response
  // rows). Snapshots freeze the form at send time. Mirrors the mock fixtures.
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const formById = new Map<string, (typeof orgFormsFx)[string][number] & { orgId: string }>();
  for (const [orgId, list] of Object.entries(orgFormsFx)) {
    for (const f of list) {
      formById.set(f.id, { ...f, orgId });
      await db.insert(schema.forms).values({
        id: f.id, orgId, kind: f.kind, title: f.title, intro: f.intro ?? null, fields: f.fields,
        status: f.status, theme: f.theme ?? null, shareToken: f.shareToken ?? null, shareEnabled: f.shareEnabled ?? false,
        createdBy: "system", createdAt: daysAgo(f.createdDaysAgo), updatedAt: daysAgo(f.updatedDaysAgo),
      }).onConflictDoUpdate({
        target: schema.forms.id,
        set: { title: f.title, intro: f.intro ?? null, fields: f.fields, theme: f.theme ?? null, shareToken: f.shareToken ?? null, shareEnabled: f.shareEnabled ?? false, updatedAt: daysAgo(f.updatedDaysAgo) },
      });
    }
  }
  for (const a of formAssignmentsFx) {
    const f = formById.get(a.formId);
    if (!f) continue;
    const snapshot = { kind: f.kind, title: f.title, intro: f.intro, fields: f.fields };
    await db.insert(schema.formAssignments).values({
      id: a.id, orgId: f.orgId, formId: a.formId, clientId: a.clientId, token: a.token, status: a.status,
      snapshot, answers: a.answers ?? null, sentBy: "system", sentAt: daysAgo(a.sentDaysAgo),
      submittedAt: a.submittedDaysAgo != null ? daysAgo(a.submittedDaysAgo) : null,
    }).onConflictDoNothing();
  }

  // ── Team messaging cluster (internal staff chat) ──────────────────────
  for (const t of teamThreadsFx) {
    const firstAt = t.messages[0] ? new Date(t.messages[0].at) : now;
    const last = t.messages[t.messages.length - 1];
    const lastAt = last ? new Date(last.at) : now;
    await db.insert(schema.messageThreads).values({
      id: t.id, orgId: "org_masizakhe", kind: "direct", title: null,
      pairKey: `org_masizakhe:${[...t.participants].sort().join(":")}`,
      createdBy: t.participants[0], createdAt: firstAt, lastMessageAt: lastAt,
    }).onConflictDoNothing();
    for (const uid of t.participants) {
      await db.insert(schema.threadMembers).values({
        orgId: "org_masizakhe", threadId: t.id, userId: uid,
        lastReadAt: uid === t.unreadFor ? null : lastAt, joinedAt: firstAt,
      }).onConflictDoNothing();
    }
    for (const m of t.messages) {
      await db.insert(schema.teamMessages).values({
        id: m.id, orgId: "org_masizakhe", threadId: t.id, senderUserId: m.from, body: m.text, createdAt: new Date(m.at),
      }).onConflictDoNothing();
    }
  }

  // ── Billing cluster (client invoices + org-level extras) ──────────────
  // The fixtures are anchored to a fixed "today" (their newest invoice is 2026-06-24);
  // shift every invoice by the same delta so the ladder stays intact but lands around
  // NOW  otherwise "income this month" decays to R0 whenever the demo is seeded later.
  const INV_ANCHOR = new Date("2026-06-24T09:00:00+02:00").getTime(); // the fixtures' newest invoice
  const invDelta = now.getTime() - INV_ANCHOR; // newest invoice → today; the ladder pulls a recent paid one into this month
  const shiftInv = (iso: string) => new Date(new Date(iso).getTime() + invDelta);
  const allInvoices = [...Object.values(invoicesFx).flat(), ...extraInvoicesFx];
  for (const v of allInvoices) {
    // Update the dates on conflict so a re-seed re-anchors them to the new "now"
    // (they'd otherwise stay frozen at whatever the first seed wrote).
    await db.insert(schema.invoices).values({ id: v.id, clientId: v.clientId, orgId: v.orgId, number: v.number, serviceName: v.serviceName, amountCents: v.amountCents, status: v.status, issuedAt: shiftInv(v.issuedAt), dueAt: shiftInv(v.dueAt) })
      .onConflictDoUpdate({ target: schema.invoices.id, set: { issuedAt: shiftInv(v.issuedAt), dueAt: shiftInv(v.dueAt), status: v.status } });
  }

  // ── Funders & grants cluster (M&E) ────────────────────────────────────
  for (const f of fundersFx) await db.insert(schema.funders).values({ id: f.id, orgId: f.orgId, name: f.name, type: f.type, contactName: f.contactName, contactEmail: f.contactEmail }).onConflictDoNothing();
  for (const g of grantsFx) await db.insert(schema.grants).values({ id: g.id, funderId: g.funderId, orgId: g.orgId, title: g.title, periodStart: g.periodStart, periodEnd: g.periodEnd, amountCents: g.amountCents, restricted: g.restricted, reportingSchedule: g.reportingSchedule, status: g.status }).onConflictDoNothing();
  for (const i of indicatorsFx) await db.insert(schema.grantIndicators).values({ id: i.id, grantId: i.grantId, name: i.name, type: i.type, metric: i.metric, target: i.target, unit: i.unit, rule: i.rule }).onConflictDoNothing();
  for (const a of allocationsFx) await db.insert(schema.grantAllocations).values({ grantId: a.grantId, clientId: a.clientId }).onConflictDoNothing();
  for (const n of narrativesFx) await db.insert(schema.grantNarratives).values({ id: n.id, grantId: n.grantId, author: n.author, body: n.body, postedAt: new Date(n.postedAt) }).onConflictDoNothing();
  for (const fc of funderContactsFx) await db.insert(schema.funderContacts).values({ userId: fc.userId, funderId: fc.funderId, grantIds: fc.grantIds }).onConflictDoNothing();

  // ── Messaging (Phase 12): system templates + demo settings/credits ────
  const msgNow = new Date();
  for (const channel of CHANNELS) {
    for (const trigger of TRIGGERS) {
      await db.insert(schema.messageTemplates).values({
        id: `tpl_sys_${channel}_${trigger}`, orgId: null, channel, key: trigger,
        body: DEFAULT_TEMPLATES[channel][trigger], whatsappTemplateName: channel === "whatsapp" ? `phila_${trigger}` : null, updatedAt: msgNow,
      }).onConflictDoNothing();
    }
  }
  await db.insert(schema.orgMessagingSettings).values({
    orgId: "org_masizakhe", whatsappEnabled: false, smsEnabled: true, emailEnabled: true,
    emailReplyTo: "reception@masizakhe.org.za", emailFromName: "Masizakhe Counselling", quietStart: "21:00", quietEnd: "07:00", updatedAt: msgNow,
  }).onConflictDoNothing();
  // Notification credits  a healthy starter balance so email confirmations flow
  // out of the box (500 SMS + 1000 email). Ledgered; idempotent per grant key.
  const STARTER_CREDITS = { sms: 500, email: 1000 } as const;
  for (const channel of ["sms", "email"] as const) {
    const amount = STARTER_CREDITS[channel];
    await db.insert(schema.creditBalances).values({ orgId: "org_masizakhe", channel, balance: amount }).onConflictDoNothing();
    await db.insert(schema.creditLedger).values({ orgId: "org_masizakhe", channel, delta: amount, reason: "grant", ref: "seed", idempotencyKey: `seed_grant_${channel}_org_masizakhe`, balanceAfter: amount, createdAt: msgNow }).onConflictDoNothing();
  }

  // Plan catalogue (W3.4)  the super-admin-editable tier table. Seeded from the code
  // PLANS so a fresh DB has the catalogue; onConflictDoNothing keeps admin edits intact.
  for (const [i, p] of PLANS.entries()) {
    await db.insert(schema.plans).values({
      id: p.id, name: p.name, tagline: p.tagline, priceCents: p.priceCents, seats: p.seats,
      aiTokens: p.aiTokens, videoMinutes: p.videoMinutes, messaging: p.messaging, rooms: p.rooms,
      storageGb: p.storageGb, popular: Boolean(p.popular), ngo: Boolean(p.ngo), sortOrder: i, active: true,
    }).onConflictDoNothing();
  }

  // Phila subscription (Phase 15A)  Masizakhe is on the Community plan, billed monthly.
  const periodEnd = new Date(Date.UTC(msgNow.getUTCFullYear(), msgNow.getUTCMonth() + 1, 1));
  await db.insert(schema.subscriptions).values({
    orgId: "org_masizakhe", planId: "p_community", status: "active", currentPeriodEnd: periodEnd, providerRef: "seed", updatedAt: msgNow,
  }).onConflictDoNothing();

  // M&E demographic cohort (Phase 16)  a realistic, consented cohort so the funder /
  // reporting dashboards are meaningful (and cross the k-anonymity floor). Deterministic.
  await seedCohort(msgNow);

  // Public micro-site (Phase 17)  rich, ready-to-rank content for Masizakhe.
  await db.insert(schema.orgPublicPages).values({
    orgId: ORG,
    heroHeadline: "Counselling that meets you where you are",
    heroSubtitle: "Warm, confidential counselling for individuals, couples, and families across Gauteng  in person in Soweto and the Johannesburg CBD, or online from anywhere.",
    showOnlineBadge: true,
    aboutTitle: "About Masizakhe",
    aboutBody: "Masizakhe Counselling is a community-rooted practice. Our registered counsellors and psychologists work with depression, anxiety, trauma, grief, and relationship difficulties  at a pace that suits you, in a space that feels safe. We see clients privately and through funded community programmes, and we keep your information confidential and protected under POPIA.",
    showAbout: true,
    approachTitle: "How we work",
    approachItems: [
      { title: "Confidential & POPIA-protected", body: "What you share stays private. Your records are encrypted and only seen by your care team." },
      { title: "Affordable & funded options", body: "Private sessions or funded community programmes  we'll help you find what fits." },
      { title: "In person or online", body: "Meet us in Soweto or the JHB CBD, or join a secure video room from anywhere." },
    ],
    showApproach: true,
    showServices: true,
    showTeam: true,
    faqItems: [
      { question: "How do I book a first session?", answer: "Tap “Book a session”, choose a service and a time that suits you, and complete a short intake. You'll get a confirmation right away." },
      { question: "Is what I share confidential?", answer: "Yes. Sessions are private and your information is protected under POPIA. We only share information with your explicit consent." },
      { question: "Do you offer online sessions?", answer: "Yes  you can join a secure, in-region video room from any device. Choose “online” when you book." },
      { question: "What does it cost?", answer: "Fees vary by service and are shown when you book. We also run funded community programmes  ask us if cost is a barrier." },
    ],
    showFaq: true,
    showContact: true,
    contactEmail: "reception@masizakhe.org.za",
    contactPhone: "+27 11 555 0100",
    ctaText: "Book a session",
    seoTitle: "Masizakhe Counselling  counselling in Soweto & Johannesburg",
    seoDescription: "Warm, confidential counselling for individuals, couples and families in Gauteng. In person in Soweto and the JHB CBD, or online. Book a session today.",
    updatedAt: msgNow,
  }).onConflictDoNothing();

  // Video gateway (Phase 17.1)  LiveKit is admin-managed, seeded in Demo (self-host)
  // mode with the local Docker dev keys. The super-admin can edit or switch to Live.
  if (process.env.PHILA_FIELD_KEY) {
    await db.insert(schema.platformIntegrations).values({
      key: "livekit",
      credentialsEnc: encField(JSON.stringify({ mode: "demo", wsUrl: "ws://localhost:7880", apiKey: "devkey", apiSecret: "secret" })),
      enabled: true,
      updatedAt: msgNow,
    }).onConflictDoNothing();
  }

  // ── Platform onboarding checklist (super-admin) ───────────────────────
  for (let i = 0; i < onboardingReqFx.length; i++) {
    const r = onboardingReqFx[i]!;
    await db.insert(schema.onboardingRequirements).values({ id: r.id, label: r.label, description: r.description, required: r.required, sort: i }).onConflictDoNothing();
  }

  // ── Extra tenants so the platform console shows a real, varied multi-tenant view ──
  // Lightweight but honest: an org row + subscription + a few staff + recent sessions +
  // (for AI-plan orgs) usage. Stats on /admin are then computed from these real rows.
  const EXTRA_ORGS = [
    { id: "org_thrive", name: "Thrive EAP", slug: "thrive-eap", province: "Western Cape", planId: "p_enterprise", status: "active" as const, createdAt: "2023-11-15", members: 5, sessions7d: 9, aiSpendCents: 124300, onboarding: "submitted" },
    { id: "org_ubuntu", name: "Ubuntu Community Care", slug: "ubuntu-community-care", province: "KwaZulu-Natal", planId: "p_community", status: "trialing" as const, createdAt: "2026-06-10", members: 4, sessions7d: 6, aiSpendCents: 4200, onboarding: "not_started" },
    { id: "org_mindwell", name: "MindWell Wellness", slug: "mindwell-wellness", province: "Gauteng", planId: "p_practice", status: "past_due" as const, createdAt: "2025-03-20", members: 3, sessions7d: 3, aiSpendCents: 0, onboarding: "action_needed" },
    { id: "org_khula", name: "Khula Trust", slug: "khula-trust", province: "Eastern Cape", planId: "p_community", status: "cancelled" as const, createdAt: "2024-09-01", members: 2, sessions7d: 0, aiSpendCents: 0, onboarding: "verified" },
  ];
  const EXTRA_ROLES = ["org_admin", "counsellor", "counsellor", "front_desk", "finance"] as const;
  for (const o of EXTRA_ORGS) {
    await db.insert(schema.orgs).values({
      id: o.id, name: o.name, slug: o.slug, province: o.province, timezone: "Africa/Johannesburg",
      features: {}, scheduling: {}, clientPortal: {}, onboardingStatus: o.onboarding,
      onboardingSubmittedAt: o.onboarding === "submitted" ? msgNow : null,
      createdAt: new Date(`${o.createdAt}T08:00:00+02:00`),
    }).onConflictDoNothing();
    await db.insert(schema.subscriptions).values({ orgId: o.id, planId: o.planId, status: o.status, currentPeriodEnd: periodEnd, providerRef: "seed", updatedAt: msgNow }).onConflictDoNothing();
    // Staff (ghost users) → real member count.
    for (let i = 0; i < o.members; i++) {
      const uid = `${o.id}_u${i}`;
      await db.insert(schema.user).values({ id: uid, name: `${o.name} Staff ${i + 1}`, email: `staff${i + 1}@${o.slug}.example`, emailVerified: true, createdAt: msgNow, updatedAt: msgNow, platformRole: null, clientId: null }).onConflictDoNothing();
      await db.insert(schema.account).values({ id: `acct_${uid}`, accountId: uid, providerId: "credential", userId: uid, password: hash, createdAt: msgNow, updatedAt: msgNow }).onConflictDoNothing();
      await db.insert(schema.orgMembers).values({ orgId: o.id, userId: uid, teamRole: EXTRA_ROLES[i % EXTRA_ROLES.length]!, isSupervisor: false, status: "active", createdAt: msgNow }).onConflictDoNothing();
    }
    // Recent sessions → sessions7d (spread across the last 6 days).
    for (let i = 0; i < o.sessions7d; i++) {
      await db.insert(schema.appointments).values({
        id: `${o.id}_appt${i}`, orgId: o.id, clientId: `${o.id}_cl${i}`, counsellorId: `${o.id}_co${i}`, serviceId: "svc_generic",
        // Distinct counsellor + distinct time per row → never trips the overlap exclusion constraint.
        type: "online", roomId: null, startsAt: new Date(msgNow.getTime() - (i + 1) * 4 * 3_600_000), durationMin: 60, state: "completed", tags: [],
      }).onConflictDoNothing({ target: schema.appointments.id });
    }
    // AI usage this month → aiSpendCents (orgs on an AI-capable plan).
    if (o.aiSpendCents > 0) {
      await db.insert(schema.aiUsage).values({ orgId: o.id, kind: "note", model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 0, costCents: o.aiSpendCents, at: msgNow }).onConflictDoNothing();
    }
  }

  // ── Second tenant with REAL data (Thrive EAP) ─────────────────────────
  // The extra orgs above are lightweight (ghost staff/appointments for the counts).
  // Thrive gets a proper admin + counsellor login, real clients, and real sessions so
  // tenant-isolation / RLS is demonstrable end-to-end and the console has a second
  // fully-explorable tenant. (Its own gateway/consent stay minimal — a real trial org.)
  const THRIVE = "org_thrive";
  const thriveUsers = [
    { id: "user_thrive_admin", name: "Adri Louw", email: "admin@thrive-eap.co.za", teamRole: "org_admin" as const },
    { id: "user_thrive_couns", name: "Dr Yolanda Meyer", email: "counsellor@thrive-eap.co.za", teamRole: "counsellor" as const },
  ];
  for (const u of thriveUsers) {
    await db.insert(schema.user).values({ id: u.id, name: u.name, email: u.email, emailVerified: true, createdAt: msgNow, updatedAt: msgNow, platformRole: null, clientId: null }).onConflictDoNothing();
    await db.insert(schema.account).values({ id: `acct_${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: hash, createdAt: msgNow, updatedAt: msgNow }).onConflictDoNothing();
    await db.insert(schema.orgMembers).values({ orgId: THRIVE, userId: u.id, teamRole: u.teamRole, isSupervisor: u.teamRole === "counsellor", status: "active", createdAt: msgNow }).onConflictDoNothing();
  }
  await db.insert(schema.counsellors).values({
    id: "couns_thrive", userId: "user_thrive_couns", orgId: THRIVE, name: "Dr Yolanda Meyer",
    credentialBody: "HPCSA", credentialRegNo: "PS-0104521", credentialStatus: "verified", isSupervisor: true, supervisorId: null,
  }).onConflictDoNothing();
  const thriveClients = [
    { id: "cl_thrive_1", name: "Riedwaan Adams" }, { id: "cl_thrive_2", name: "Chloe van Wyk" },
    { id: "cl_thrive_3", name: "Sibongile Dube" }, { id: "cl_thrive_4", name: "Marius Fourie" },
  ];
  for (let i = 0; i < thriveClients.length; i++) {
    const c = thriveClients[i]!;
    await db.insert(schema.clients).values({ id: c.id, orgId: THRIVE, name: c.name, province: "Western Cape", primaryCounsellorId: "couns_thrive", riskFlag: false, createdAt: new Date(msgNow.getTime() - (30 + i * 12) * 86_400_000) }).onConflictDoNothing();
  }
  // Real sessions for Thrive's own counsellor (distinct times → no overlap).
  const thriveAppts = [
    { id: "appt_thrive_1", clientId: "cl_thrive_1", dayBack: 0, hour: 9, state: "completed" },
    { id: "appt_thrive_2", clientId: "cl_thrive_2", dayBack: 0, hour: 11, state: "scheduled" },
    { id: "appt_thrive_3", clientId: "cl_thrive_3", dayBack: 0, hour: 14, state: "scheduled" },
    { id: "appt_thrive_4", clientId: "cl_thrive_1", dayBack: 1, hour: 9, state: "completed" },
    { id: "appt_thrive_5", clientId: "cl_thrive_4", dayBack: 3, hour: 11, state: "completed" },
    { id: "appt_thrive_6", clientId: "cl_thrive_2", dayBack: -1, hour: 10, state: "scheduled" },
  ];
  const thriveToday = sastDate(msgNow);
  for (const a of thriveAppts) {
    await db.insert(schema.appointments).values({
      id: a.id, orgId: THRIVE, clientId: a.clientId, counsellorId: "couns_thrive", serviceId: "svc_individual",
      type: "online", roomId: null, startsAt: new Date(`${addDays(thriveToday, -a.dayBack)}T${String(a.hour).padStart(2, "0")}:00:00+02:00`),
      durationMin: 60, state: a.state, tags: [],
    }).onConflictDoNothing({ target: schema.appointments.id });
  }
  await db.insert(schema.invoices).values({ id: "inv_thrive_1", clientId: "cl_thrive_1", orgId: THRIVE, number: "TH-2026-0007", serviceName: "Individual counselling", amountCents: 60000, status: "paid", issuedAt: shiftInv("2026-06-16T09:00:00+02:00"), dueAt: shiftInv("2026-06-30T09:00:00+02:00") })
    .onConflictDoUpdate({ target: schema.invoices.id, set: { issuedAt: shiftInv("2026-06-16T09:00:00+02:00"), dueAt: shiftInv("2026-06-30T09:00:00+02:00") } });

  // ── Per-org onboarding submissions (after every org exists, for the FK) ──
  for (const [orgId, docs] of Object.entries(onboardingDocsFx)) {
    for (const [reqId, d] of Object.entries(docs)) {
      await db.insert(schema.orgOnboardingDocs).values({
        orgId, requirementId: reqId, status: d.status, fileName: d.fileName,
        uploadedAt: new Date(msgNow.getTime() - d.daysAgo * 86_400_000),
      }).onConflictDoNothing();
    }
  }

  // ── Polish: payment history + public-page analytics ───────────────────
  // A short, honest payment ledger for Masizakhe (a settled invoice, a credit
  // top-up, the monthly subscription) so the billing/payments views read real.
  const daysAgoTs = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const SEED_PAYMENTS = [
    { ref: "seed_pay_inv2", purpose: "invoice", invoiceId: "inv2", creditsAmount: 0, amountCents: 45000, daysAgo: 9 },
    { ref: "seed_pay_credit_sms", purpose: "credit_sms", packId: "sms_500", creditsAmount: 500, amountCents: 25000, daysAgo: 20 },
    { ref: "seed_pay_sub", purpose: "subscription", packId: "p_community", creditsAmount: 0, amountCents: 65000, daysAgo: 6 },
  ] as const;
  for (const p of SEED_PAYMENTS) {
    await db.insert(schema.payments).values({
      orgId: "org_masizakhe", provider: "paystack", providerRef: p.ref, purpose: p.purpose,
      packId: "packId" in p ? p.packId : null, invoiceId: "invoiceId" in p ? p.invoiceId : null,
      creditsAmount: p.creditsAmount, amountCents: p.amountCents, status: "paid",
      createdAt: daysAgoTs(p.daysAgo), paidAt: daysAgoTs(p.daysAgo),
    }).onConflictDoNothing({ target: schema.payments.providerRef });
  }
  // Public micro-site traffic over the last fortnight → the "how is my page doing"
  // panel. A realistic funnel: many views, some book-clicks, a few bookings. The rows
  // have a random-uuid PK (no natural key), so clear the org's set first to stay idempotent.
  await db.delete(schema.publicPageEvents).where(eq(schema.publicPageEvents.orgId, "org_masizakhe"));
  const PPE: { kind: string; daysAgo: number }[] = [];
  for (let d = 13; d >= 0; d--) {
    const views = 3 + ((d * 7) % 5); // 3–7 views/day
    for (let v = 0; v < views; v++) PPE.push({ kind: "view", daysAgo: d });
    if (d % 2 === 0) PPE.push({ kind: "book_click", daysAgo: d });
    if (d % 5 === 0) PPE.push({ kind: "booked", daysAgo: d });
  }
  for (let i = 0; i < PPE.length; i++) {
    const e = PPE[i]!;
    await db.insert(schema.publicPageEvents).values({
      orgId: "org_masizakhe", kind: e.kind,
      at: new Date(now.getTime() - e.daysAgo * 86_400_000 - (i % 24) * 3_600_000),
    }).onConflictDoNothing();
  }

  // Waitlist (W7) — a couple of clients waiting, so the waitlist + auto-offer is demonstrable.
  await db.insert(schema.waitlistEntries).values([
    { id: "wl_seed_1", orgId: ORG, clientId: "cl_naledi", counsellorId: "couns_nomsa", serviceId: "svc_individual", note: "Prefers mornings", status: "waiting", createdAt: new Date(now.getTime() - 6 * 86_400_000) },
    { id: "wl_seed_2", orgId: ORG, clientId: "cl_megan", counsellorId: null, serviceId: null, note: "Flexible on counsellor", status: "waiting", createdAt: new Date(now.getTime() - 2 * 86_400_000) },
  ]).onConflictDoNothing();

  // A pending client change request (W6.2) so the hub's requests queue is demonstrable.
  // Tied to a real upcoming scheduled session (cl_fatima with Nomsa, tomorrow).
  await db.insert(schema.appointmentChangeRequests).values({
    id: "acr_seed_1", orgId: ORG, appointmentId: "appt_couns_nomsa_8", clientId: "cl_fatima",
    kind: "reschedule", reason: "Something's come up at work that morning  could we move to the afternoon?",
    status: "pending", createdAt: new Date(now.getTime() - 3 * 3_600_000),
  }).onConflictDoNothing();

  // Sliding-scale / subsidised fees (W7) — realistic NGO variety on the demo caseload.
  await db.update(schema.clients).set({ feePolicy: { kind: "percentage", value: 50 } }).where(eq(schema.clients.id, "cl_johan"));
  await db.update(schema.clients).set({ feePolicy: { kind: "waived" } }).where(eq(schema.clients.id, "cl_demo_002"));
  await db.update(schema.clients).set({ feePolicy: { kind: "fixed", value: 15000 } }).where(eq(schema.clients.id, "cl_zanele"));

  // GAD-7 (anxiety) series alongside PHQ-9 for a few clients (W7) — so the client
  // outcome trends show both tools, not just depression. Improving, weeks 8 → 4 → now.
  const gad7 = [{ id: "cl_lerato", scores: [14, 9, 5] }, { id: "cl_johan", scores: [12, 8, 6] }, { id: "cl_demo_001", scores: [16, 11, 7] }];
  const gadWeeks = [8, 4, 0];
  for (const g of gad7) {
    for (let k = 0; k < g.scores.length; k++) {
      await db.insert(schema.outcomeMeasures).values({ id: `om_gad_${g.id}_${k}`, clientId: g.id, tool: "GAD-7", score: g.scores[k]!, takenAt: new Date(now.getTime() - gadWeeks[k]! * 7 * 86_400_000) }).onConflictDoNothing();
    }
  }

  // Referral tracking (W7) — a realistic spread of how the cohort found the practice, so
  // the "Where clients come from" Insights breakdown is meaningful. (masizakhe has it on.)
  const REFERRAL_MIX = ["word_of_mouth", "whatsapp", "sadag", "medical", "search", "funder_programme", "social", "school_employer", "returning", "word_of_mouth"];
  const namedSources: [string, string][] = [["cl_lerato", "sadag"], ["cl_johan", "medical"], ["cl_sipho", "word_of_mouth"], ["cl_fatima", "whatsapp"], ["cl_zanele", "search"], ["cl_kabelo", "school_employer"], ["cl_naledi", "funder_programme"], ["cl_megan", "returning"]];
  for (const [id, src] of namedSources) await db.update(schema.clients).set({ referralSource: src }).where(eq(schema.clients.id, id));
  for (let i = 0; i < 30; i++) await db.update(schema.clients).set({ referralSource: REFERRAL_MIX[i % REFERRAL_MIX.length]! }).where(eq(schema.clients.id, `cl_demo_${String(i + 1).padStart(3, "0")}`));

  const sql = neon(url!);
  const [c] = await sql`select
    (select count(*)::int from orgs) orgs,
    (select count(*)::int from "user") users,
    (select count(*)::int from counsellors) counsellors,
    (select count(*)::int from clients) clients,
    (select count(*)::int from services) services,
    (select count(*)::int from rooms) rooms,
    (select count(*)::int from demographics) demographics,
    (select count(*)::int from consents) consents,
    (select count(*)::int from appointments) appointments,
    (select count(*)::int from care_plans) care_plans,
    (select count(*)::int from client_documents) documents,
    (select count(*)::int from outcome_measures) outcomes,
    (select count(*)::int from invoices) invoices,
    (select count(*)::int from funders) funders,
    (select count(*)::int from grants) grants,
    (select count(*)::int from grant_indicators) indicators`;
  console.log("seeded:", c);
}

/**
 * A deterministic, consented M&E cohort (Phase 16). ~30 clients for Masizakhe with
 * demographics + demographics-consent + an improving PHQ-9 series + grant allocations
 *  so reporting/grant dashboards are real and meaningful (most cells clear k=5).
 */
async function seedCohort(now: Date): Promise<void> {
  const FIRST = ["Lerato", "Sipho", "Naledi", "Thabang", "Zanele", "Kabelo", "Ayanda", "Tshepo", "Nomvula", "Mpho", "Bongani", "Refilwe", "Lindiwe", "Sibusiso", "Palesa", "Mandla", "Thandiwe", "Kagiso", "Nokuthula", "Lwazi", "Boitumelo", "Andile", "Dimpho", "Katlego", "Nosipho", "Themba", "Zinhle", "Olwethu", "Karabo", "Amahle"];
  const LAST = ["Mokoena", "Dlamini", "Nkosi", "Khumalo", "Mahlangu", "Sithole", "Zulu", "Ndlovu", "Mthembu", "Tshabalala", "Molefe", "Ngcobo", "Botha", "Pillay", "Naidoo"];
  const GENDERS: Array<"female" | "male" | "non_binary"> = ["female", "female", "female", "male", "female", "male", "female", "male", "female", "non_binary"];
  const AGES = ["18_24", "25_34", "18_24", "35_44", "25_34", "18_24", "45_54", "25_34", "under_18", "35_44"];
  const PROV = ["Gauteng", "Gauteng", "Gauteng", "Gauteng", "Western Cape", "KwaZulu-Natal", "Gauteng", "Limpopo", "Gauteng", "Western Cape"];
  const POP = ["black_african", "black_african", "black_african", "coloured", "black_african", "indian_asian", "black_african", "white", "black_african", "coloured"];
  const EMP = ["unemployed", "employed", "student", "employed", "self_employed", "unemployed", "student", "employed", "unemployed", "self_employed"];

  // Sessions are spread across the four counsellors; a per-counsellor day cursor keeps
  // every counsellor's cohort appointments ≥2 days apart so none overlap (the deferred
  // exclusion constraint), and clear of the ±3-day day-templates (all ≥7 days back).
  const COUNS = ["couns_nomsa", "couns_thabo", "couns_aisha", "couns_pieter"];
  const dayCursor: Record<string, number> = { couns_nomsa: 0, couns_thabo: 0, couns_aisha: 0, couns_pieter: 0 };
  const today = sastDate(now);

  const N = 30;
  for (let i = 0; i < N; i++) {
    const id = `cl_demo_${String(i + 1).padStart(3, "0")}`;
    const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
    const province = PROV[i % PROV.length]!;
    const createdAt = new Date(now.getTime() - ((i % 6) * 30 + 5) * 86_400_000); // spread over ~6 months
    await db.insert(schema.clients).values({ id, orgId: ORG, name, province, riskFlag: i % 11 === 0, createdAt }).onConflictDoNothing();
    await db.insert(schema.demographics).values({ clientId: id, gender: GENDERS[i % GENDERS.length]!, populationGroup: POP[i % POP.length]!, employmentStatus: EMP[i % EMP.length]!, ageBand: AGES[i % AGES.length]!, province }).onConflictDoNothing();
    await db.insert(schema.consents).values({ orgId: ORG, clientId: id, purpose: "demographics", state: "granted", version: 1, updatedAt: createdAt }).onConflictDoNothing();

    // PHQ-9 trajectory: ~70% improve ≥5 (first−latest), rest plateau. Weeks 8 → 4 → now.
    const start = 15 + (i % 6); // 15–20
    const improves = i % 10 < 7;
    const series = improves ? [start, start - 4, start - 8] : [start, start - 1, start - 1];
    const weeks = [8, 4, 0];
    for (let k = 0; k < series.length; k++) {
      const takenAt = new Date(now.getTime() - weeks[k]! * 7 * 86_400_000);
      await db.insert(schema.outcomeMeasures).values({ id: `om_${id}_${k}`, clientId: id, tool: "PHQ-9", score: Math.max(0, series[k]!), takenAt }).onConflictDoNothing();
    }

    // Completed sessions → the grants' "sessions delivered" indicator (reads ~0 without
    // these). 4–8 per client over the last few months, round-robined across counsellors.
    const sessions = 4 + (i % 5);
    for (let k = 0; k < sessions; k++) {
      const c = COUNS[(i + k) % COUNS.length]!;
      const seq = dayCursor[c] ?? 0;
      dayCursor[c] = seq + 1;
      const dayBack = 7 + seq * 2;
      const hour = 8 + (seq % 8);
      const startsAt = new Date(`${addDays(today, -dayBack)}T${String(hour).padStart(2, "0")}:00:00+02:00`);
      await db.insert(schema.appointments).values({
        id: `appt_coh_${id}_${k}`, orgId: ORG, clientId: id, counsellorId: c, serviceId: "svc_individual",
        type: "online", roomId: null, startsAt, durationMin: 60, state: "completed", tags: [],
      }).onConflictDoNothing({ target: schema.appointments.id });
    }

    // Allocate to grants: ~73% to DSD, every 3rd also to the Lotto youth grant.
    if (i % 11 !== 0) await db.insert(schema.grantAllocations).values({ grantId: "g_dsd", clientId: id }).onConflictDoNothing();
    if (i % 3 === 0) await db.insert(schema.grantAllocations).values({ grantId: "g_lotto", clientId: id }).onConflictDoNothing();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
