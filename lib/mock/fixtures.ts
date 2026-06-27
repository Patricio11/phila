/**
 * Typed fixtures  a believable South African community-counselling org, not
 * filler. Real-shaped isiZulu / isiXhosa / Afrikaans / English / Gujarati names
 * across communities, ZAR pricing, +27 numbers, HPCSA / ASCHP / SACSSP
 * registration, Gauteng sites. The demo should read like a real practice's
 * Monday, because that is the quality bar (Mock-First Rule).
 *
 * Static entities live here; the mock provider materialises a *live* week of
 * appointments around "now" so the dashboard is always populated, any day.
 */
import type {
  Appointment,
  Client,
  ConsentRecord,
  Counsellor,
  Demographics,
  Org,
  Room,
  Service,
  Site,
} from "@/lib/mock/types";
import type { ConsentPurpose } from "@/lib/domain/enums";

const ORG_ID = "org_masizakhe";

const businessHours: Org["scheduling"]["businessHours"] = {
  1: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
  2: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
  3: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
  4: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "13:45" }] },
  5: { start: "08:00", end: "15:00", breaks: [{ start: "12:30", end: "13:00" }] },
  6: null,
  7: null,
};

export const orgs: Org[] = [
  {
    id: ORG_ID,
    name: "Masizakhe Counselling",
    slug: "masizakhe",
    brandAccent: "#1C7D58",
    province: "Gauteng",
    timezone: "Africa/Johannesburg",
    features: { ai: false, video: false, whatsapp: false, sms: false, payments: false },
    scheduling: { defaultDurationMin: 60, bufferMin: 10, businessHours },
  },
];

export const sites: Site[] = [
  { id: "site_soweto", orgId: ORG_ID, name: "Soweto  Vilakazi branch", province: "Gauteng" },
  { id: "site_jhb", orgId: ORG_ID, name: "Johannesburg CBD branch", province: "Gauteng" },
];

export const rooms: Room[] = [
  {
    id: "room_s1",
    orgId: ORG_ID,
    siteId: "site_soweto",
    name: "Consulting room 1",
    capacity: 2,
    equipment: ["wheelchair access"],
    status: "active",
    colour: "#1C7D58",
  },
  {
    id: "room_s2",
    orgId: ORG_ID,
    siteId: "site_soweto",
    name: "Play-therapy room",
    capacity: 4,
    equipment: ["play-therapy kit", "wheelchair access"],
    status: "active",
    colour: "#3C7FB0",
  },
  {
    id: "room_j1",
    orgId: ORG_ID,
    siteId: "site_jhb",
    name: "Consulting room A",
    capacity: 2,
    equipment: [],
    status: "active",
    colour: "#9a6418",
  },
  {
    id: "room_j2",
    orgId: ORG_ID,
    siteId: "site_jhb",
    name: "Group room",
    capacity: 8,
    equipment: ["projector"],
    status: "maintenance",
    colour: "#6b4f8a",
  },
];

export const counsellors: Counsellor[] = [
  {
    id: "couns_nomsa",
    userId: "user_nomsa",
    orgId: ORG_ID,
    name: "Nomsa Dlamini",
    credential: { body: "HPCSA", registrationNo: "PS 0123456", status: "verified" },
    isSupervisor: true,
    supervisorId: null,
  },
  {
    id: "couns_thabo",
    userId: "user_thabo",
    orgId: ORG_ID,
    name: "Thabo Mokoena",
    credential: { body: "ASCHP", registrationNo: "ASCHP-44821", status: "pending" },
    isSupervisor: false,
    supervisorId: "couns_nomsa",
  },
  {
    id: "couns_aisha",
    userId: "user_aisha",
    orgId: ORG_ID,
    name: "Aisha Patel",
    credential: { body: "HPCSA", registrationNo: "PS 0098765", status: "verified" },
    isSupervisor: false,
    supervisorId: "couns_nomsa",
  },
  {
    id: "couns_pieter",
    userId: "user_pieter",
    orgId: ORG_ID,
    name: "Pieter van der Merwe",
    credential: { body: "SACSSP", registrationNo: "10-12345", status: "verified" },
    isSupervisor: false,
    supervisorId: "couns_nomsa",
  },
];

export const services: Service[] = [
  { id: "svc_individual", orgId: ORG_ID, name: "Individual counselling", durationMin: 60, priceCents: 45000 },
  { id: "svc_couples", orgId: ORG_ID, name: "Couples counselling", durationMin: 90, priceCents: 75000 },
  { id: "svc_assessment", orgId: ORG_ID, name: "Initial assessment", durationMin: 60, priceCents: 50000 },
  { id: "svc_trauma", orgId: ORG_ID, name: "Trauma debriefing", durationMin: 60, priceCents: null },
];

export const clients: Client[] = [
  client("cl_lerato", "Lerato Mahlangu", "+27 82 451 7720", "lerato.m@example.co.za", "Gauteng", "couns_nomsa"),
  client("cl_sipho", "Sipho Khumalo", "+27 73 902 1185", undefined, "Gauteng", "couns_nomsa", true, "2026-06-23T09:00:00+02:00"),
  client("cl_fatima", "Fatima Adams", "+27 21 696 4410", "fatima.adams@example.co.za", "Western Cape", "couns_nomsa", false, "2026-03-15T09:00:00+02:00"),
  client("cl_johan", "Johan Botha", "+27 84 220 9931", "jbotha@example.co.za", "Free State", "couns_nomsa", false, "2026-06-10T09:00:00+02:00"),
  client("cl_zanele", "Zanele Ngcobo", "+27 71 884 2207", undefined, "KwaZulu-Natal", "couns_nomsa", false, "2025-12-01T09:00:00+02:00"),
  client("cl_naledi", "Naledi Tshabalala", "+27 79 145 6620", "naledi.t@example.co.za", "Gauteng", "couns_thabo", false, "2026-06-25T09:00:00+02:00"),
  client("cl_kabelo", "Kabelo Moeketsi", "+27 60 778 3344", undefined, "Gauteng", "couns_aisha", false, "2026-01-20T09:00:00+02:00"),
  client("cl_megan", "Megan Pillay", "+27 83 661 9027", "megan.pillay@example.co.za", "KwaZulu-Natal", "couns_pieter", false, "2026-04-02T09:00:00+02:00"),
  // A realistic double-entry: same person captured twice (same name + phone)  the dedupe surfaces it.
  client("cl_lerato_2", "Lerato Mahlangu", "+27 82 451 7720", undefined, "Gauteng", "couns_nomsa", false, "2026-06-26T09:00:00+02:00"),
];

function client(
  id: string,
  name: string,
  phone: string | undefined,
  email: string | undefined,
  province: Client["province"],
  primaryCounsellorId: string,
  riskFlag = false,
  createdAt = "2025-11-03T09:00:00+02:00",
): Client {
  return {
    id,
    orgId: ORG_ID,
    name,
    phone,
    email,
    province,
    primaryCounsellorId,
    riskFlag,
    createdAt,
    deletedAt: null,
  };
}

/** Demographics exist only where the `demographics` purpose is consented. */
export const demographics: Demographics[] = [
  { clientId: "cl_lerato", gender: "female", populationGroup: "black_african", employmentStatus: "employed", ageBand: "35_44", province: "Gauteng" },
  { clientId: "cl_fatima", gender: "female", populationGroup: "coloured", employmentStatus: "self_employed", ageBand: "45_54", province: "Western Cape" },
  { clientId: "cl_johan", gender: "male", populationGroup: "white", employmentStatus: "unemployed", ageBand: "55_64", province: "Free State" },
  { clientId: "cl_zanele", gender: "female", populationGroup: "black_african", employmentStatus: "student", ageBand: "18_24", province: "KwaZulu-Natal" },
  { clientId: "cl_naledi", gender: "female", populationGroup: "black_african", employmentStatus: "employed", ageBand: "25_34", province: "Gauteng" },
];

/** Consents  not everyone has granted everything; the demo shows honest gaps. */
export const consents: ConsentRecord[] = [
  ...consentSet("cl_lerato", ["booking", "notes", "demographics", "comms", "care_plan_share", "funder_reporting"]),
  ...consentSet("cl_sipho", ["booking", "notes", "comms"]),
  ...consentSet("cl_fatima", ["booking", "notes", "demographics", "comms", "funder_reporting"]),
  ...consentSet("cl_johan", ["booking", "notes", "demographics"]),
  ...consentSet("cl_zanele", ["booking", "notes", "demographics", "comms", "care_plan_share", "funder_reporting"]),
  ...consentSet("cl_naledi", ["booking", "notes", "demographics", "comms"]),
  ...consentSet("cl_kabelo", ["booking", "notes"]),
  ...consentSet("cl_megan", ["booking", "notes", "comms"]),
];

function consentSet(clientId: string, purposes: ConsentPurpose[]): ConsentRecord[] {
  return purposes.map((purpose) => ({
    clientId,
    purpose,
    state: "granted" as const,
    version: 1,
    updatedAt: "2025-11-03T09:05:00+02:00",
  }));
}

/**
 * A counsellor's typical day, as a template the provider lays onto "today".
 * `dayOffset` lets us also seed completed sessions earlier in the week and a few
 * upcoming ones, so the week stats and the schedule both read true.
 */
export interface DayTemplateEntry {
  dayOffset: number; // 0 = today, -1 = yesterday, +1 = tomorrow
  time: string; // "HH:MM" SAST
  clientId: string;
  serviceId: string;
  type: Appointment["type"];
  roomId: string | null;
  state: Appointment["state"];
  tags?: string[];
}

export const counsellorDayTemplates: Record<string, DayTemplateEntry[]> = {
  couns_nomsa: [
    { dayOffset: 0, time: "08:30", clientId: "cl_lerato", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "completed" },
    { dayOffset: 0, time: "09:45", clientId: "cl_sipho", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "risk_flagged", tags: ["Safeguarding"] },
    { dayOffset: 0, time: "11:00", clientId: "cl_fatima", serviceId: "svc_assessment", type: "online", roomId: null, state: "scheduled", tags: ["Intake"] },
    { dayOffset: 0, time: "14:00", clientId: "cl_johan", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "scheduled" },
    { dayOffset: 0, time: "15:15", clientId: "cl_zanele", serviceId: "svc_couples", type: "online", roomId: null, state: "scheduled", tags: ["Couple"] },
    { dayOffset: -1, time: "10:00", clientId: "cl_lerato", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "completed" },
    { dayOffset: -2, time: "09:00", clientId: "cl_johan", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "completed" },
    { dayOffset: -2, time: "11:30", clientId: "cl_zanele", serviceId: "svc_individual", type: "online", roomId: null, state: "no_show" },
    { dayOffset: 1, time: "09:00", clientId: "cl_fatima", serviceId: "svc_individual", type: "online", roomId: null, state: "scheduled" },
  ],
};

/**
 * A client's own appointments, materialised around "now" (mirrors the counsellor
 * template approach). Lerato has an upcoming online session (to show Join), a
 * recurring weekly series, and a short history.
 */
export interface ClientApptTemplate {
  dayOffset: number;
  time: string;
  counsellorId: string;
  serviceId: string;
  type: Appointment["type"];
  roomId: string | null;
  state: Appointment["state"];
}

export const clientApptTemplates: Record<string, ClientApptTemplate[]> = {
  cl_lerato: [
    { dayOffset: 2, time: "10:00", counsellorId: "couns_nomsa", serviceId: "svc_individual", type: "online", roomId: null, state: "scheduled" },
    { dayOffset: 0, time: "08:30", counsellorId: "couns_nomsa", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "completed" },
    { dayOffset: -7, time: "10:00", counsellorId: "couns_nomsa", serviceId: "svc_individual", type: "online", roomId: null, state: "completed" },
    { dayOffset: -14, time: "10:00", counsellorId: "couns_nomsa", serviceId: "svc_individual", type: "in_person", roomId: "room_s1", state: "completed" },
    { dayOffset: -21, time: "10:00", counsellorId: "couns_nomsa", serviceId: "svc_assessment", type: "in_person", roomId: "room_s1", state: "completed" },
  ],
};

/** The client-shared care plan (NOT the private note)  shared by the counsellor. */
export const carePlans: Record<string, import("@/lib/mock/types").CarePlan> = {
  cl_lerato: {
    id: "care_lerato",
    clientId: "cl_lerato",
    authorCounsellorId: "couns_nomsa",
    summary:
      "You've been carrying a lot at work and at home, and we're working on small, steady ways to protect your energy. You named that mornings are hardest  let's keep building the wind-down routine that's already helping you sleep.",
    tasks: [
      { id: "t1", text: "Try the 4-7-8 breathing for a few minutes before bed", done: true },
      { id: "t2", text: "Write down one thing that went okay each day", done: false },
      { id: "t3", text: "Take a short walk on the days that feel heavy", done: false },
    ],
    resources: [
      { label: "A gentle wind-down routine", note: "The one-page guide we went through" },
      { label: "SADAG support line: 0800 567 567", note: "Free, any time  a real person to talk to" },
    ],
    nextStep: "We'll check in on the morning routine at your next session and adjust together.",
    sharedAt: "2026-06-20T16:00:00+02:00",
  },
};

export const clientDocuments: Record<string, import("@/lib/mock/types").ClientDocument[]> = {
  cl_lerato: [
    { id: "doc1", clientId: "cl_lerato", orgId: ORG_ID, name: "Your care plan  June", kind: "report", sizeLabel: "1 page", sharedBy: "counsellor", createdAt: "2026-06-20T16:01:00+02:00" },
    { id: "doc2", clientId: "cl_lerato", orgId: ORG_ID, name: "Wind-down routine guide", kind: "resource", sizeLabel: "PDF · 320 KB", sharedBy: "counsellor", createdAt: "2026-06-13T15:30:00+02:00" },
    { id: "doc3", clientId: "cl_lerato", orgId: ORG_ID, name: "Intake form (completed)", kind: "form", sizeLabel: "2 pages", sharedBy: "org", createdAt: "2026-05-09T09:10:00+02:00" },
  ],
};

export const invoices: Record<string, import("@/lib/mock/types").Invoice[]> = {
  cl_lerato: [
    { id: "inv1", clientId: "cl_lerato", orgId: ORG_ID, number: "MZ-2026-0142", serviceName: "Individual counselling", amountCents: 45000, status: "unpaid", issuedAt: "2026-06-23T09:00:00+02:00", dueAt: "2026-07-07T09:00:00+02:00" },
    { id: "inv2", clientId: "cl_lerato", orgId: ORG_ID, number: "MZ-2026-0131", serviceName: "Individual counselling", amountCents: 45000, status: "paid", issuedAt: "2026-06-09T09:00:00+02:00", dueAt: "2026-06-23T09:00:00+02:00" },
    { id: "inv3", clientId: "cl_lerato", orgId: ORG_ID, number: "MZ-2026-0118", serviceName: "Initial assessment", amountCents: 50000, status: "paid", issuedAt: "2026-05-12T09:00:00+02:00", dueAt: "2026-05-26T09:00:00+02:00" },
  ],
};

/** Mock message threads per counsellor (WhatsApp-first; the rail is dormant). */
export interface ChatMessage {
  id: string;
  from: "client" | "counsellor";
  text: string;
  at: string;
}
export interface ConversationSeed {
  clientId: string;
  clientName: string;
  unread: number;
  messages: ChatMessage[];
}

export const conversations: Record<string, ConversationSeed[]> = {
  couns_nomsa: [
    {
      clientId: "cl_lerato",
      clientName: "Lerato Mahlangu",
      unread: 1,
      messages: [
        { id: "m1", from: "counsellor", text: "Hi Lerato  looking forward to our session on Monday. The wind-down routine we spoke about is on your care plan.", at: "2026-06-26T14:10:00+02:00" },
        { id: "m2", from: "client", text: "Thank you Nomsa. The breathing has really been helping at night 🙏", at: "2026-06-26T18:32:00+02:00" },
        { id: "m3", from: "client", text: "Quick question  should I keep the journal even on the good days?", at: "2026-06-27T07:15:00+02:00" },
      ],
    },
    {
      clientId: "cl_fatima",
      clientName: "Fatima Adams",
      unread: 0,
      messages: [
        { id: "m4", from: "counsellor", text: "Hi Fatima, your online assessment is at 11:00 today. You'll join from your Phila portal.", at: "2026-06-27T08:00:00+02:00" },
        { id: "m5", from: "client", text: "Perfect, I'm ready. See you then.", at: "2026-06-27T08:22:00+02:00" },
      ],
    },
    {
      clientId: "cl_johan",
      clientName: "Johan Botha",
      unread: 0,
      messages: [
        { id: "m6", from: "client", text: "Had to move some things around this week  are we still on for Thursday?", at: "2026-06-25T16:40:00+02:00" },
        { id: "m7", from: "counsellor", text: "We are, Johan  14:00 in Consulting room 1. See you then.", at: "2026-06-25T17:05:00+02:00" },
      ],
    },
  ],
};

/* ---- Platform (super-admin) ------------------------------------------ */

export const plans: import("@/lib/mock/types").Plan[] = [
  { id: "p_community", name: "Community", tagline: "For NGOs, faith-based & community services", priceCents: 65000, seats: 8, aiTokens: 50000, videoMinutes: 300, messaging: true, rooms: 5, ngo: true },
  { id: "p_practice", name: "Practice", tagline: "For a growing private practice", priceCents: 120000, seats: 5, aiTokens: 0, videoMinutes: 0, messaging: false, rooms: 3 },
  { id: "p_programme", name: "Programme", tagline: "For multi-counsellor programmes & EAPs", priceCents: 350000, seats: 15, aiTokens: 100000, videoMinutes: 600, messaging: true, rooms: 10, popular: true },
  { id: "p_enterprise", name: "Enterprise", tagline: "For large EAPs & provider networks", priceCents: 750000, seats: null, aiTokens: 500000, videoMinutes: 2000, messaging: true, rooms: null },
];

export const platformOrgs: import("@/lib/mock/types").PlatformOrg[] = [
  { id: "org_masizakhe", name: "Masizakhe Counselling", province: "Gauteng", planId: "p_programme", subscriptionStatus: "active", members: 8, sessions7d: 42, aiSpendCents: 18500, createdAt: "2024-02-01", suspended: false },
  { id: "org_thrive", name: "Thrive EAP", province: "Western Cape", planId: "p_enterprise", subscriptionStatus: "active", members: 22, sessions7d: 96, aiSpendCents: 124300, createdAt: "2023-11-15", suspended: false },
  { id: "org_ubuntu", name: "Ubuntu Community Care", province: "KwaZulu-Natal", planId: "p_community", subscriptionStatus: "trialing", members: 6, sessions7d: 18, aiSpendCents: 4200, createdAt: "2026-06-10", suspended: false },
  { id: "org_mindwell", name: "MindWell Wellness", province: "Gauteng", planId: "p_practice", subscriptionStatus: "past_due", members: 4, sessions7d: 11, aiSpendCents: 0, createdAt: "2025-03-20", suspended: false },
  { id: "org_khula", name: "Khula Trust", province: "Eastern Cape", planId: "p_community", subscriptionStatus: "cancelled", members: 3, sessions7d: 0, aiSpendCents: 0, createdAt: "2024-09-01", suspended: true },
];

export const aiRailConfig: import("@/lib/mock/types").AiRailConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  maxTokens: 4000,
  status: "mock",
  s72Acknowledged: false,
  monthlySpendCents: 147000,
  defaultOrgCapCents: 200000,
};

export const integrationsCatalogue: import("@/lib/mock/types").IntegrationCatalogItem[] = [
  { key: "whatsapp", name: "WhatsApp (Meta Cloud API)", category: "messaging", status: "mock", description: "Booking, reminder, and follow-up messages  WhatsApp-first." },
  { key: "sms", name: "SMS (Clickatell)", category: "messaging", status: "off", description: "SMS fallback for clients without WhatsApp." },
  { key: "livekit", name: "LiveKit video", category: "video", status: "mock", description: "Self-hosted, in-region video rooms for online sessions." },
  { key: "stitch", name: "Stitch", category: "payments", status: "mock", description: "PayShap & pay-by-bank  orgs connect their own account." },
  { key: "ozow", name: "Ozow", category: "payments", status: "off", description: "PayShap & instant EFT." },
  { key: "yoco", name: "Yoco", category: "payments", status: "mock", description: "Card payments." },
  { key: "paystack", name: "Paystack", category: "payments", status: "off", description: "Card payments." },
  { key: "platform_psp", name: "Phila platform billing", category: "platform", status: "live", description: "Phila's own PSP  how orgs pay their subscription." },
];

export const platformAuditEvents: import("@/lib/mock/types").PlatformAuditEvent[] = [
  { id: "pa1", at: "2026-06-27T09:14:00+02:00", action: "impersonate.start", actor: "Sizwe Ndlovu", orgName: "MindWell Wellness", target: "org_mindwell", reason: "support_ticket_4821" },
  { id: "pa2", at: "2026-06-27T08:52:00+02:00", action: "note.read_hub_override", actor: "Thandeka Mbeki", orgName: "Masizakhe Counselling", target: "appointment:appt_couns_nomsa_1/note", reason: "hub_override" },
  { id: "pa3", at: "2026-06-26T16:30:00+02:00", action: "pii.export", actor: "Bongani Nkosi", orgName: "Thrive EAP", target: "funder_report.pdf", reason: "funder_export_k_anon" },
  { id: "pa4", at: "2026-06-26T14:05:00+02:00", action: "consent.change", actor: "Lerato Mahlangu", orgName: "Masizakhe Counselling", target: "consent:funder_reporting", reason: "client_revoked" },
  { id: "pa5", at: "2026-06-26T11:20:00+02:00", action: "admin.action", actor: "Sizwe Ndlovu", orgName: "Ubuntu Community Care", target: "plan:p_community", reason: "trial_started" },
  { id: "pa6", at: "2026-06-25T15:48:00+02:00", action: "demographics.read", actor: "Thandeka Mbeki", orgName: "Masizakhe Counselling", target: "org/reporting", reason: "demographic_filter" },
  { id: "pa7", at: "2026-06-25T10:02:00+02:00", action: "funder.view", actor: "Palesa Mokoena", orgName: "Masizakhe Counselling", target: "grant:g_dsd", reason: "view_grant_progress" },
  { id: "pa8", at: "2026-06-24T17:33:00+02:00", action: "admin.action", actor: "Sizwe Ndlovu", orgName: "Khula Trust", target: "org_khula", reason: "suspend_nonpayment" },
];

/* ---- Funders & grants (M&E) ------------------------------------------ */

export const funders: import("@/lib/mock/types").Funder[] = [
  { id: "f_dsd", orgId: ORG_ID, name: "Department of Social Development", type: "government", contactName: "Palesa Mokoena", contactEmail: "palesa.mokoena@dsd.example.gov.za" },
  { id: "f_lotto", orgId: ORG_ID, name: "National Lotteries Commission", type: "lottery", contactName: "Sibusiso Dube", contactEmail: "grants@nlc.example.org.za" },
  { id: "f_csi", orgId: ORG_ID, name: "Standard Bank CSI", type: "corporate_csi", contactName: "Megan Reddy", contactEmail: "csi@standardbank.example.co.za" },
];

export const grants: import("@/lib/mock/types").Grant[] = [
  { id: "g_dsd", funderId: "f_dsd", orgId: ORG_ID, title: "Community Wellness Programme", periodStart: "2026-04-01", periodEnd: "2027-03-31", amountCents: 85000000, restricted: true, reportingSchedule: "quarterly", status: "active" },
  { id: "g_lotto", funderId: "f_lotto", orgId: ORG_ID, title: "Youth Mental Health", periodStart: "2026-01-01", periodEnd: "2026-12-31", amountCents: 120000000, restricted: true, reportingSchedule: "biannual", status: "active" },
];

export const grantIndicators: import("@/lib/mock/types").GrantIndicator[] = [
  { id: "i_dsd_1", grantId: "g_dsd", name: "Unique clients reached", type: "count", metric: "unique_clients", target: 30, unit: "clients", rule: "Distinct clients tagged to this grant." },
  { id: "i_dsd_2", grantId: "g_dsd", name: "Female participants", type: "percentage", metric: "pct_female", target: 60, unit: "%", rule: "Share of consented participants who are female." },
  { id: "i_dsd_3", grantId: "g_dsd", name: "Improved ≥5 on PHQ-9", type: "outcome_delta", metric: "phq9_improved_5", target: 70, unit: "%", rule: "Share with a ≥5-point PHQ-9 drop, first to latest." },
  { id: "i_dsd_4", grantId: "g_dsd", name: "Sessions delivered", type: "count", metric: "sessions_delivered", target: 200, unit: "sessions", rule: "Completed sessions for tagged clients in the period." },
  { id: "i_lotto_1", grantId: "g_lotto", name: "Young people reached", type: "count", metric: "unique_clients", target: 20, unit: "clients", rule: "Distinct clients tagged to this grant." },
  { id: "i_lotto_2", grantId: "g_lotto", name: "Under-25 participants", type: "demographic_proportion", metric: "pct_youth", target: 50, unit: "%", rule: "Share of consented participants aged under 25." },
  { id: "i_lotto_3", grantId: "g_lotto", name: "Sessions delivered", type: "count", metric: "sessions_delivered", target: 120, unit: "sessions", rule: "Completed sessions for tagged clients in the period." },
];

export const grantAllocations: import("@/lib/mock/types").GrantAllocation[] = [
  { grantId: "g_dsd", clientId: "cl_lerato" },
  { grantId: "g_dsd", clientId: "cl_sipho" },
  { grantId: "g_dsd", clientId: "cl_fatima" },
  { grantId: "g_dsd", clientId: "cl_johan" },
  { grantId: "g_dsd", clientId: "cl_zanele" },
  { grantId: "g_dsd", clientId: "cl_naledi" },
  { grantId: "g_lotto", clientId: "cl_zanele" },
  { grantId: "g_lotto", clientId: "cl_naledi" },
  { grantId: "g_lotto", clientId: "cl_kabelo" },
];

export const grantNarratives: import("@/lib/mock/types").GrantNarrative[] = [
  { id: "n1", grantId: "g_dsd", author: "Thandeka Mbeki", body: "Q1 is off to a steady start. We've onboarded six clients into the programme and held the first round of assessments. Early PHQ-9 movement is encouraging, especially for clients balancing work and caregiving. We're focusing outreach on reaching more participants in the coming weeks.", postedAt: "2026-06-20T14:00:00+02:00" },
];

/** Funder users scoped to their grant(s)  read-only (Phase 9 real invite flow). */
export const funderContacts: import("@/lib/mock/types").FunderContact[] = [
  { userId: "user_funder", funderId: "f_dsd", grantIds: ["g_dsd"] },
];

/** A counsellor's aggregate PHQ-9 trajectory (lower is better). */
export const outcomeSeries: Record<string, { label: string; value: number }[]> = {
  couns_nomsa: [
    { label: "Wk 1", value: 18 },
    { label: "Wk 2", value: 17 },
    { label: "Wk 3", value: 15 },
    { label: "Wk 4", value: 14 },
    { label: "Wk 5", value: 11 },
    { label: "Wk 6", value: 9 },
  ],
};

/** Per-client outcome measures (weeksAgo → materialised takenAt around now). */
export const clientOutcomes: Record<
  string,
  { tool: "PHQ-9" | "GAD-7"; score: number; weeksAgo: number }[]
> = {
  cl_lerato: [
    { tool: "PHQ-9", score: 18, weeksAgo: 6 },
    { tool: "PHQ-9", score: 16, weeksAgo: 4 },
    { tool: "PHQ-9", score: 13, weeksAgo: 2 },
    { tool: "PHQ-9", score: 9, weeksAgo: 0 },
  ],
  cl_johan: [
    { tool: "PHQ-9", score: 21, weeksAgo: 5 },
    { tool: "PHQ-9", score: 19, weeksAgo: 3 },
    { tool: "PHQ-9", score: 17, weeksAgo: 1 },
  ],
  cl_zanele: [
    { tool: "GAD-7", score: 14, weeksAgo: 4 },
    { tool: "GAD-7", score: 11, weeksAgo: 2 },
    { tool: "GAD-7", score: 8, weeksAgo: 0 },
  ],
};

/**
 * The org team  every role, not just counsellors (ROADMAP: org has operational
 * roles too). Drives /hub/team and the honest-permissions view.
 */
export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  teamRole: import("@/lib/domain/enums").TeamRole;
  isSupervisor: boolean;
  active: boolean;
  counsellorId?: string;
  joinedAt: string;
}

export const teamMembers: TeamMember[] = [
  { userId: "user_thandeka", name: "Thandeka Mbeki", email: "thandeka@masizakhe.org.za", teamRole: "org_admin", isSupervisor: false, active: true, joinedAt: "2024-02-01T08:00:00+02:00" },
  { userId: "user_nomsa", name: "Nomsa Dlamini", email: "nomsa@masizakhe.org.za", teamRole: "counsellor", isSupervisor: true, active: true, counsellorId: "couns_nomsa", joinedAt: "2024-03-12T08:00:00+02:00" },
  { userId: "user_thabo", name: "Thabo Mokoena", email: "thabo@masizakhe.org.za", teamRole: "counsellor", isSupervisor: false, active: true, counsellorId: "couns_thabo", joinedAt: "2025-01-20T08:00:00+02:00" },
  { userId: "user_aisha", name: "Aisha Patel", email: "aisha@masizakhe.org.za", teamRole: "counsellor", isSupervisor: false, active: true, counsellorId: "couns_aisha", joinedAt: "2024-08-05T08:00:00+02:00" },
  { userId: "user_pieter", name: "Pieter van der Merwe", email: "pieter@masizakhe.org.za", teamRole: "counsellor", isSupervisor: false, active: true, counsellorId: "couns_pieter", joinedAt: "2025-04-15T08:00:00+02:00" },
  { userId: "user_lindiwe", name: "Lindiwe Khoza", email: "frontdesk@masizakhe.org.za", teamRole: "front_desk", isSupervisor: false, active: true, joinedAt: "2024-06-01T08:00:00+02:00" },
  { userId: "user_riaan", name: "Riaan Steyn", email: "finance@masizakhe.org.za", teamRole: "finance", isSupervisor: false, active: true, joinedAt: "2024-04-22T08:00:00+02:00" },
  { userId: "user_bongani", name: "Bongani Nkosi", email: "programmes@masizakhe.org.za", teamRole: "programme_manager", isSupervisor: false, active: false, joinedAt: "2024-09-30T08:00:00+02:00" },
];

/** Rich HR-style profile for a team member (the Hub member page). */
export interface TeamProfile {
  userId: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  languages: string[];
  bio: string;
  qualifications: { qualification: string; institution: string; year: number }[];
  specialties: string[];
}

export const teamProfiles: Record<string, TeamProfile> = {
  user_thandeka: {
    userId: "user_thandeka", phone: "+27 82 551 0193", dateOfBirth: "1980-05-14", address: "14 Stanley Avenue, Milpark, Johannesburg, 2092",
    languages: ["English", "isiZulu", "Sesotho"],
    bio: "Founded Masizakhe in 2018 to bring affordable, dignified counselling to the communities she grew up in. Leads operations, funder relationships, and governance.",
    qualifications: [
      { qualification: "BA Social Work", institution: "University of the Witwatersrand", year: 2002 },
      { qualification: "MBA", institution: "GIBS Business School", year: 2014 },
    ],
    specialties: ["Practice leadership", "Funder reporting", "POPIA governance"],
  },
  user_nomsa: {
    userId: "user_nomsa", phone: "+27 83 274 6650", dateOfBirth: "1985-09-22", address: "6 Acacia Road, Kensington, Johannesburg, 2094",
    languages: ["English", "isiZulu", "isiXhosa"],
    bio: "Clinical psychologist and clinical lead. Supervises the counselling team and carries a trauma-focused caseload. Passionate about culturally grounded care.",
    qualifications: [
      { qualification: "MA Clinical Psychology", institution: "University of Johannesburg", year: 2011 },
      { qualification: "BA Psychology (Hons)", institution: "University of Pretoria", year: 2008 },
    ],
    specialties: ["Trauma & PTSD", "Anxiety", "Family systems", "Clinical supervision"],
  },
  user_thabo: {
    userId: "user_thabo", phone: "+27 84 119 8023", dateOfBirth: "1990-11-03", address: "22 Vilakazi Street, Orlando West, Soweto, 1804",
    languages: ["English", "Sesotho", "Setswana"],
    bio: "Registered counsellor working with adolescents and young adults. Runs the school outreach programme on Thursdays.",
    qualifications: [
      { qualification: "BPsych (Hons) Counselling", institution: "University of Pretoria", year: 2015 },
    ],
    specialties: ["Adolescents", "Depression", "School outreach"],
  },
  user_aisha: {
    userId: "user_aisha", phone: "+27 82 906 3317", dateOfBirth: "1988-02-18", address: "8 Sunningdale Drive, Reservoir Hills, Durban, 4091",
    languages: ["English", "Afrikaans", "Hindi"],
    bio: "Counsellor with a CBT focus, working across individual and couples work. Splits her week between the Johannesburg and satellite rooms.",
    qualifications: [
      { qualification: "BSocSci Counselling", institution: "University of KwaZulu-Natal", year: 2012 },
      { qualification: "Postgrad Diploma in CBT", institution: "SACAP", year: 2016 },
    ],
    specialties: ["CBT", "Couples", "Burnout"],
  },
  user_pieter: {
    userId: "user_pieter", phone: "+27 71 442 5589", dateOfBirth: "1992-07-29", address: "31 Dorp Street, Stellenbosch, 7600",
    languages: ["Afrikaans", "English"],
    bio: "Registered counsellor focused on substance use and men's mental health. Joined Masizakhe in 2025 from a community NPO in the Cape.",
    qualifications: [
      { qualification: "BPsych", institution: "Stellenbosch University", year: 2016 },
    ],
    specialties: ["Substance use", "Men's mental health", "Motivational interviewing"],
  },
  user_lindiwe: {
    userId: "user_lindiwe", phone: "+27 60 318 7742", dateOfBirth: "1995-12-08", address: "104 Bree Street, Newtown, Johannesburg, 2113",
    languages: ["English", "isiZulu"],
    bio: "Front-of-house and scheduling. The first warm voice every client hears; keeps the diary and rooms running.",
    qualifications: [
      { qualification: "National Certificate: Office Administration", institution: "Boston City Campus", year: 2015 },
    ],
    specialties: ["Scheduling", "Client reception", "Intake coordination"],
  },
  user_riaan: {
    userId: "user_riaan", phone: "+27 82 663 2204", dateOfBirth: "1983-03-26", address: "18 Long Street, Bloemfontein, 9301",
    languages: ["Afrikaans", "English"],
    bio: "Handles billing, PayShap reconciliation, and funder financial reporting.",
    qualifications: [
      { qualification: "BCom Accounting", institution: "University of the Free State", year: 2005 },
    ],
    specialties: ["Billing", "Reconciliation", "Financial reporting"],
  },
  user_bongani: {
    userId: "user_bongani", phone: "+27 73 550 9981", dateOfBirth: "1987-08-11", address: "27 Church Street, Pietermaritzburg, 3201",
    languages: ["English", "isiZulu"],
    bio: "Programme manager for funded work. Currently on extended leave.",
    qualifications: [
      { qualification: "BA Development Studies", institution: "University of South Africa", year: 2010 },
    ],
    specialties: ["Programme management", "M&E", "Grant delivery"],
  },
};

/** Counsellor ↔ room recurring day/time assignments (the room schedule). */
export interface RoomAssignment {
  id: string;
  counsellorId: string;
  roomId: string;
  /** ISO weekdays the pattern applies (1=Mon … 7=Sun). */
  days: number[];
  start: string;
  end: string;
}

export const roomAssignments: RoomAssignment[] = [
  { id: "ra1", counsellorId: "couns_nomsa", roomId: "room_s1", days: [1, 3], start: "08:00", end: "13:00" },
  { id: "ra2", counsellorId: "couns_thabo", roomId: "room_s2", days: [2, 4], start: "09:00", end: "15:00" },
  { id: "ra3", counsellorId: "couns_aisha", roomId: "room_j1", days: [1, 2, 3, 4, 5], start: "08:00", end: "12:00" },
  { id: "ra4", counsellorId: "couns_pieter", roomId: "room_j1", days: [3], start: "13:00", end: "17:00" },
];

/** A few more invoices across clients so org invoicing has real spread. */
export const orgExtraInvoices: import("@/lib/mock/types").Invoice[] = [
  { id: "inv_s1", clientId: "cl_fatima", orgId: ORG_ID, number: "MZ-2026-0145", serviceName: "Initial assessment", amountCents: 50000, status: "unpaid", issuedAt: "2026-06-24T09:00:00+02:00", dueAt: "2026-07-08T09:00:00+02:00" },
  { id: "inv_s2", clientId: "cl_johan", orgId: ORG_ID, number: "MZ-2026-0140", serviceName: "Individual counselling", amountCents: 45000, status: "paid", issuedAt: "2026-06-18T09:00:00+02:00", dueAt: "2026-07-02T09:00:00+02:00" },
  { id: "inv_s3", clientId: "cl_zanele", orgId: ORG_ID, number: "MZ-2026-0138", serviceName: "Couples counselling", amountCents: 75000, status: "unpaid", issuedAt: "2026-06-16T09:00:00+02:00", dueAt: "2026-06-30T09:00:00+02:00" },
  { id: "inv_s4", clientId: "cl_naledi", orgId: ORG_ID, number: "MZ-2026-0133", serviceName: "Individual counselling", amountCents: 45000, status: "cancelled", issuedAt: "2026-06-10T09:00:00+02:00", dueAt: "2026-06-24T09:00:00+02:00" },
];

/** Supervisee notes awaiting the supervisor's sign-off (materialised around now). */
export const supervisionTemplates: {
  superviseeId: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  sessionDayOffset: number;
  submittedDayOffset: number;
}[] = [
  { superviseeId: "couns_thabo", clientId: "cl_naledi", clientName: "Naledi Tshabalala", serviceId: "svc_individual", sessionDayOffset: -1, submittedDayOffset: -1 },
  { superviseeId: "couns_aisha", clientId: "cl_kabelo", clientName: "Kabelo Moeketsi", serviceId: "svc_individual", sessionDayOffset: -2, submittedDayOffset: -1 },
  { superviseeId: "couns_thabo", clientId: "cl_naledi", clientName: "Naledi Tshabalala", serviceId: "svc_assessment", sessionDayOffset: -8, submittedDayOffset: -7 },
];

/** The org's intake form, rendered during booking (Phase 2). */
export const intakeForms: Record<string, import("@/lib/mock/types").IntakeForm> = {
  [ORG_ID]: {
    id: "intake_masizakhe",
    orgId: ORG_ID,
    title: "A few details before we meet",
    intro:
      "This helps your counsellor prepare. Only your counsellor sees it, and it's kept confidential under POPIA.",
    fields: [
      { id: "full_name", label: "Your full name", type: "text", required: true, sensitive: true, placeholder: "e.g. Lerato Mahlangu" },
      { id: "phone", label: "Mobile number", type: "tel", required: true, sensitive: true, placeholder: "+27 …", help: "We'll use this to confirm your session." },
      { id: "email", label: "Email (optional)", type: "email", required: false, sensitive: true, placeholder: "you@example.co.za" },
      { id: "reason", label: "What would you like support with?", type: "textarea", required: true, placeholder: "A sentence or two is plenty  only your counsellor will read this.", help: "There's no right answer. Share as much or as little as you like." },
      { id: "preferred_contact", label: "How should we reach you?", type: "radio", required: true, options: ["WhatsApp", "Phone call", "Email"] },
      { id: "first_time", label: "Have you had counselling before?", type: "radio", required: false, options: ["This is my first time", "Yes, before", "I'd rather not say"] },
    ],
  },
};

/** Public micro-site copy per org  no PII, safe to render unauthenticated. */
export const orgPublicContent: Record<
  string,
  { intro: string; about: string; offersOnline: boolean }
> = {
  [ORG_ID]: {
    intro:
      "Warm, confidential counselling for individuals, couples, and families across Gauteng  in person in Soweto and the Johannesburg CBD, or online from anywhere.",
    about:
      "Masizakhe Counselling is a community-rooted practice. Our registered counsellors and psychologists work with depression, anxiety, trauma, grief, and relationship difficulties  at a pace that suits you, in a space that feels safe. We see clients privately and through funded community programmes, and we keep your information confidential and protected under POPIA.",
    offersOnline: true,
  },
};

export const fixtures = {
  orgs,
  sites,
  rooms,
  counsellors,
  services,
  clients,
  demographics,
  consents,
  counsellorDayTemplates,
  outcomeSeries,
};
