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
import { eq } from "drizzle-orm";
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
  orgForms as orgFormsFx,
  formAssignments as formAssignmentsFx,
} from "@/lib/mock/fixtures";
import { CHANNELS, TRIGGERS, DEFAULT_TEMPLATES } from "@/lib/messaging/templates";

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
  { id: "user_lerato", name: "Lerato Mahlangu", email: "lerato.m@example.co.za", platformRole: "client", clientId: "cl_lerato" },
  { id: "user_funder", name: "Palesa Mokoena", email: "palesa.mokoena@dsd.example.gov.za", platformRole: "funder", clientId: null },
  { id: "user_operator", name: "Sizwe Ndlovu", email: "ops@philasa.com", platformRole: "super_admin", clientId: null },
];

const MEMBERS = [
  { userId: "user_nomsa", teamRole: "counsellor", isSupervisor: true },
  { userId: "user_thabo", teamRole: "counsellor", isSupervisor: false },
  { userId: "user_aisha", teamRole: "counsellor", isSupervisor: false },
  { userId: "user_pieter", teamRole: "counsellor", isSupervisor: false },
  { userId: "user_thandeka", teamRole: "org_admin", isSupervisor: false },
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
    createdAt: now,
  }).onConflictDoNothing();

  // ── Identity (users + credentials + memberships) ──────────────────────
  for (const u of DEMO_USERS) {
    await db.insert(schema.user).values({ id: u.id, name: u.name, email: u.email, emailVerified: true, createdAt: now, updatedAt: now, platformRole: u.platformRole, clientId: u.clientId }).onConflictDoNothing();
    await db.insert(schema.account).values({ id: `acct_${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: hash, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }
  for (const m of MEMBERS) {
    await db.insert(schema.orgMembers).values({ orgId: ORG, userId: m.userId, teamRole: m.teamRole, isSupervisor: m.isSupervisor }).onConflictDoNothing();
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

  for (const [clientId, measures] of Object.entries(outcomesFx)) {
    for (let i = 0; i < measures.length; i++) {
      const m = measures[i]!;
      await db.insert(schema.outcomeMeasures).values({ id: `om_${clientId}_${i}`, clientId, tool: m.tool, score: m.score, takenAt: new Date(now.getTime() - m.weeksAgo * 7 * 86_400_000) }).onConflictDoNothing();
    }
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
  const allInvoices = [...Object.values(invoicesFx).flat(), ...extraInvoicesFx];
  for (const v of allInvoices) {
    await db.insert(schema.invoices).values({ id: v.id, clientId: v.clientId, orgId: v.orgId, number: v.number, serviceName: v.serviceName, amountCents: v.amountCents, status: v.status, issuedAt: new Date(v.issuedAt), dueAt: new Date(v.dueAt) }).onConflictDoNothing();
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
  for (const channel of ["sms", "email"] as const) {
    await db.insert(schema.creditBalances).values({ orgId: "org_masizakhe", channel, balance: 100 }).onConflictDoNothing();
    await db.insert(schema.creditLedger).values({ orgId: "org_masizakhe", channel, delta: 100, reason: "grant", ref: "seed", idempotencyKey: `seed_grant_${channel}_org_masizakhe`, balanceAfter: 100, createdAt: msgNow }).onConflictDoNothing();
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

    // Allocate to grants: ~73% to DSD, every 3rd also to the Lotto youth grant.
    if (i % 11 !== 0) await db.insert(schema.grantAllocations).values({ grantId: "g_dsd", clientId: id }).onConflictDoNothing();
    if (i % 3 === 0) await db.insert(schema.grantAllocations).values({ grantId: "g_lotto", clientId: id }).onConflictDoNothing();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
