import "server-only";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb } from "@/db/client";
import {
  orgs, subscriptions, orgMembers, appointments, aiUsage, auditLog, aiProviders,
  onboardingRequirements, orgOnboardingDocs,
} from "@/db/schema";
import { user, account, session } from "@/db/auth-schema";
import { getPlatformIntegration } from "@/db/queries/platform-integrations";
import { getPlansMapDb } from "@/db/queries/plans";
import type { Plan } from "@/lib/domain/types";
import type {
  PlatformOverview, PlatformOrgRow, PlatformOrgDetail, OnboardingRequirement,
  OrgOnboardingReview, OnboardingDocStatus, TeamMemberView,
} from "@/lib/data-provider";
import type {
  PlatformOrg, AiRailConfig, IntegrationCatalogItem, PlatformAuditEvent,
} from "@/lib/domain/types";
import type { SubscriptionStatus, Province } from "@/lib/domain/enums";

/**
 * Platform (super-admin) reads  Workstream 1.7. The console spans every tenant, so
 * these run on the OWNER connection (BYPASSRLS), never a tenant-scoped one. Stats are
 * computed live from the real tables (orgs, subscriptions, org_members, appointments,
 * ai_usage)  no fixture. Onboarding lives in its own tables and persists here too.
 */

function monthStartUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
}

function planPriceCents(map: Map<string, Plan>, planId: string): number {
  return map.get(planId)?.priceCents ?? 0;
}
function planName(map: Map<string, Plan>, planId: string): string {
  return map.get(planId)?.name ?? "";
}

/** Every org as a PlatformOrg, with member / 7-day-session / AI-spend counts. */
async function platformOrgs(): Promise<PlatformOrg[]> {
  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthStart = monthStartUtc();
  const [orgRows, subRows, memberRows, sessionRows, spendRows, adminRows] = await Promise.all([
    db.select().from(orgs).where(isNull(orgs.deletedAt)),
    db.select({ orgId: subscriptions.orgId, planId: subscriptions.planId, status: subscriptions.status }).from(subscriptions),
    db.select({ orgId: orgMembers.orgId, c: sql<number>`count(*)::int` }).from(orgMembers).groupBy(orgMembers.orgId),
    db.select({ orgId: appointments.orgId, c: sql<number>`count(*)::int` }).from(appointments).where(gte(appointments.startsAt, weekAgo)).groupBy(appointments.orgId),
    db.select({ orgId: aiUsage.orgId, c: sql<number>`coalesce(sum(${aiUsage.costCents}),0)::int` }).from(aiUsage).where(gte(aiUsage.at, monthStart)).groupBy(aiUsage.orgId),
    // Whether each org's admin(s) have verified their email  true only if all admins are verified.
    db.select({ orgId: orgMembers.orgId, verified: sql<boolean>`bool_and(${user.emailVerified})` })
      .from(orgMembers).innerJoin(user, eq(orgMembers.userId, user.id))
      .where(eq(orgMembers.teamRole, "org_admin")).groupBy(orgMembers.orgId),
  ]);
  const subOf = new Map(subRows.map((s) => [s.orgId, s]));
  const memberOf = new Map(memberRows.map((r) => [r.orgId, r.c]));
  const sessionOf = new Map(sessionRows.map((r) => [r.orgId, r.c]));
  const spendOf = new Map(spendRows.map((r) => [r.orgId, r.c]));
  const adminVerifiedOf = new Map(adminRows.map((r) => [r.orgId, r.verified]));
  return orgRows.map((o): PlatformOrg => {
    const sub = subOf.get(o.id);
    const status = (sub?.status ?? "trialing") as SubscriptionStatus;
    return {
      id: o.id,
      name: o.name,
      province: o.province as Province,
      planId: sub?.planId ?? "p_community",
      subscriptionStatus: status,
      members: memberOf.get(o.id) ?? 0,
      sessions7d: sessionOf.get(o.id) ?? 0,
      aiSpendCents: spendOf.get(o.id) ?? 0,
      createdAt: o.createdAt.toISOString().slice(0, 10),
      suspended: status === "cancelled",
      onboardingStatus: o.onboardingStatus,
      adminEmailVerified: adminVerifiedOf.get(o.id) ?? true,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPlatformOrgsDb(): Promise<PlatformOrgRow[]> {
  const [list, planMap] = await Promise.all([platformOrgs(), getPlansMapDb()]);
  return list.map((org) => ({ org, planName: planName(planMap, org.planId), planPriceCents: planPriceCents(planMap, org.planId) }));
}

export async function getPlatformOverviewDb(): Promise<PlatformOverview> {
  const [list, integrations, planMap] = await Promise.all([platformOrgs(), listIntegrationsDb(), getPlansMapDb()]);
  const health = { live: 0, mock: 0, off: 0 };
  for (const i of integrations) health[i.status]++;
  return {
    orgCount: list.length,
    activeOrgs: list.filter((o) => o.subscriptionStatus === "active").length,
    trialingOrgs: list.filter((o) => o.subscriptionStatus === "trialing").length,
    suspendedOrgs: list.filter((o) => o.suspended).length,
    totalMembers: list.reduce((s, o) => s + o.members, 0),
    sessions7d: list.reduce((s, o) => s + o.sessions7d, 0),
    aiSpendCents: list.reduce((s, o) => s + o.aiSpendCents, 0),
    mrrCents: list.filter((o) => o.subscriptionStatus === "active").reduce((s, o) => s + planPriceCents(planMap, o.planId), 0),
    integrationHealth: health,
  };
}

export async function getPlatformOrgDetailDb(orgId: string): Promise<PlatformOrgDetail | null> {
  const [list, planMap] = await Promise.all([platformOrgs(), getPlansMapDb()]);
  const org = list.find((o) => o.id === orgId);
  if (!org) return null;
  const db = getDb();
  const [teamRows, clientCountRows, profileRows] = await Promise.all([
    db.select({
      userId: orgMembers.userId, role: orgMembers.teamRole, isSupervisor: orgMembers.isSupervisor,
      status: orgMembers.status, createdAt: orgMembers.createdAt, name: user.name, email: user.email,
    }).from(orgMembers).innerJoin(user, eq(orgMembers.userId, user.id)).where(eq(orgMembers.orgId, orgId)),
    db.select({ c: sql<number>`count(*)::int` }).from(appointments).where(eq(appointments.orgId, orgId)),
    db.select({ profile: orgs.profile }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
  ]);
  const team: TeamMemberView[] = teamRows.map((r) => ({
    userId: r.userId, name: r.name ?? "", email: r.email ?? "",
    teamRole: r.role as TeamMemberView["teamRole"], isSupervisor: r.isSupervisor,
    status: r.status as TeamMemberView["status"], active: r.status === "active",
    credential: null, joinedAt: r.createdAt.toISOString(),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    org, planName: planName(planMap, org.planId), planPriceCents: planPriceCents(planMap, org.planId),
    team, clientCount: clientCountRows[0]?.c ?? 0, fullyModeled: team.length > 0,
    profile: (profileRows[0]?.profile as Record<string, string>) ?? {},
    onboardingStatus: org.onboardingStatus,
  };
}

/** Recent platform audit events, joined to org + actor names. */
export async function listPlatformAuditDb(limit = 60): Promise<PlatformAuditEvent[]> {
  const db = getDb();
  const rows = await db.select({
    id: auditLog.id, at: auditLog.at, action: auditLog.action, target: auditLog.target,
    reason: auditLog.reason, orgName: orgs.name, actorName: user.name, actorId: auditLog.actorUserId,
  })
    .from(auditLog)
    .leftJoin(orgs, eq(auditLog.orgId, orgs.id))
    .leftJoin(user, eq(auditLog.actorUserId, user.id))
    .orderBy(desc(auditLog.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    action: r.action,
    actor: r.actorName ?? r.actorId ?? "system",
    orgName: r.orgName ?? null,
    target: r.target,
    reason: r.reason ?? null,
  }));
}

/** Public micro-site static params  every live org slug. */
export async function listOrgSlugsDb(): Promise<string[]> {
  const rows = await getDb().select({ slug: orgs.slug }).from(orgs).where(isNull(orgs.deletedAt));
  return rows.map((r) => r.slug);
}

/** The platform AI rail: the enabled provider + this month's spend across all orgs. */
export async function getAiRailDb(): Promise<AiRailConfig> {
  const db = getDb();
  const [providerRows, spendRows] = await Promise.all([
    db.select().from(aiProviders),
    db.select({ c: sql<number>`coalesce(sum(${aiUsage.costCents}),0)::int` }).from(aiUsage).where(gte(aiUsage.at, monthStartUtc())),
  ]);
  const enabled = providerRows.find((r) => r.enabled && r.apiKeyEnc);
  return {
    provider: (enabled?.provider ?? "anthropic") as AiRailConfig["provider"],
    model: enabled?.model ?? "claude-sonnet-4-6",
    maxTokens: 4000,
    status: enabled ? "live" : "off",
    s72Acknowledged: Boolean(enabled),
    monthlySpendCents: spendRows[0]?.c ?? 0,
    defaultOrgCapCents: 100000,
  };
}

/** The integration catalogue with a status derived from what's actually configured. */
const INTEGRATION_CATALOGUE: Omit<IntegrationCatalogItem, "status">[] = [
  { key: "whatsapp", name: "WhatsApp (Meta Cloud API)", category: "messaging", description: "Booking, reminder, and follow-up messages  WhatsApp-first (org BYO)." },
  { key: "sms", name: "SMS (BulkSMS)", category: "messaging", description: "Phila-provided SMS credits  reminders + notices for clients without WhatsApp." },
  { key: "email", name: "Email (Resend)", category: "messaging", description: "Transactional email  confirmations, reminders, receipts." },
  { key: "livekit", name: "LiveKit video", category: "video", description: "Self-hosted, in-region video rooms for online sessions." },
  { key: "paystack", name: "Paystack", category: "payments", description: "Card payments  orgs connect their own account." },
  { key: "platform_psp", name: "Phila platform billing", category: "platform", description: "Phila's own PSP  how orgs pay their subscription." },
];

export async function listIntegrationsDb(): Promise<IntegrationCatalogItem[]> {
  const [paystack, livekit, sms, email] = await Promise.all([
    getPlatformIntegration("paystack"),
    getPlatformIntegration("livekit"),
    getPlatformIntegration("bulksms"),
    getPlatformIntegration("resend"),
  ]);
  const statusOf = (it: { enabled: boolean; creds: Record<string, string> } | null, liveWhenDemo = false): IntegrationCatalogItem["status"] => {
    if (!it) return "off";
    if (it.enabled) return !liveWhenDemo && it.creds.mode === "demo" ? "mock" : "live";
    return Object.keys(it.creds).length > 0 ? "mock" : "off";
  };
  const map: Record<string, IntegrationCatalogItem["status"]> = {
    whatsapp: "off",
    sms: statusOf(sms),
    email: statusOf(email),
    livekit: statusOf(livekit),
    paystack: "off",
    platform_psp: statusOf(paystack, true),
  };
  return INTEGRATION_CATALOGUE.map((c) => ({ ...c, status: map[c.key] ?? "off" }));
}

/* ── Onboarding checklist + per-org review ─────────────────────────────── */

export async function listOnboardingRequirementsDb(): Promise<OnboardingRequirement[]> {
  const rows = await getDb().select().from(onboardingRequirements).orderBy(onboardingRequirements.sort);
  return rows.map((r) => ({ id: r.id, label: r.label, description: r.description, required: r.required }));
}

export async function getOrgOnboardingReviewDb(orgId: string): Promise<OrgOnboardingReview> {
  const db = getDb();
  const [reqs, docs] = await Promise.all([
    db.select().from(onboardingRequirements).orderBy(onboardingRequirements.sort),
    db.select().from(orgOnboardingDocs).where(eq(orgOnboardingDocs.orgId, orgId)),
  ]);
  const docOf = new Map(docs.map((d) => [d.requirementId, d]));
  const items = reqs.map((req) => {
    const d = docOf.get(req.id);
    return {
      requirementId: req.id,
      label: req.label,
      required: req.required,
      status: (d?.status ?? "missing") as OnboardingDocStatus,
      fileName: d?.fileName ?? null,
      uploadedAt: d?.uploadedAt ? d.uploadedAt.toISOString() : null,
    };
  });
  const required = items.filter((d) => d.required);
  const actionNeeded = items.some((d) => d.status === "rejected") || required.some((d) => d.status === "missing");
  const allVerified = required.every((d) => d.status === "verified");
  const verification = actionNeeded ? "action_needed" : allVerified ? "verified" : "pending";
  return { docs: items, verification };
}

/** Replace the platform onboarding checklist (super-admin). */
export async function saveOnboardingRequirementsDb(list: OnboardingRequirement[]): Promise<void> {
  const db = getDb();
  const ids = list.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(onboardingRequirements).where(sql`${onboardingRequirements.id} not in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  } else {
    await db.delete(onboardingRequirements);
  }
  for (let i = 0; i < list.length; i++) {
    const r = list[i]!;
    await db.insert(onboardingRequirements)
      .values({ id: r.id, label: r.label, description: r.description, required: r.required, sort: i })
      .onConflictDoUpdate({ target: onboardingRequirements.id, set: { label: r.label, description: r.description, required: r.required, sort: i } });
  }
}

/** Record the super-admin's verify/reject decision on an org's uploaded document. */
export async function reviewOnboardingDocDb(orgId: string, requirementId: string, decision: "verify" | "reject", note?: string): Promise<{ ok: boolean }> {
  const status = decision === "verify" ? "verified" : "rejected";
  const res = await getDb().update(orgOnboardingDocs)
    .set({ status, reviewNote: decision === "reject" ? (note ?? null) : null })
    .where(and(eq(orgOnboardingDocs.orgId, orgId), eq(orgOnboardingDocs.requirementId, requirementId)))
    .returning({ orgId: orgOnboardingDocs.orgId });
  return { ok: res.length > 0 };
}

/** The org's admin contact (for the approval / action-needed email). */
export async function getOrgAdminContactDb(orgId: string): Promise<{ email: string; name: string | null; orgName: string } | null> {
  const [row] = await getDb()
    .select({ email: user.email, name: user.name, orgName: orgs.name })
    .from(orgMembers)
    .innerJoin(user, eq(orgMembers.userId, user.id))
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.teamRole, "org_admin")))
    .limit(1);
  return row ? { email: row.email, name: row.name, orgName: row.orgName } : null;
}

/** Approve a practice's verification  flips the org to verified. */
export async function approveOrgDb(orgId: string): Promise<{ ok: boolean }> {
  const res = await getDb().update(orgs)
    .set({ onboardingStatus: "verified", onboardingReviewedAt: new Date() })
    .where(eq(orgs.id, orgId))
    .returning({ id: orgs.id });
  return { ok: res.length > 0 };
}

/** Send a practice's onboarding back for changes. */
export async function sendBackOnboardingDb(orgId: string): Promise<{ ok: boolean }> {
  const res = await getDb().update(orgs)
    .set({ onboardingStatus: "action_needed", onboardingReviewedAt: new Date() })
    .where(eq(orgs.id, orgId))
    .returning({ id: orgs.id });
  return { ok: res.length > 0 };
}

/** A signed download URL for one of an org's onboarding documents (super-admin). */
export async function getAdminOnboardingDocKeyDb(orgId: string, requirementId: string): Promise<string | null> {
  const [row] = await getDb().select({ key: orgOnboardingDocs.storageKey }).from(orgOnboardingDocs)
    .where(and(eq(orgOnboardingDocs.orgId, orgId), eq(orgOnboardingDocs.requirementId, requirementId))).limit(1);
  return row?.key ?? null;
}

/* ── Platform operators (super-admin user management) ──────────────────── */

export interface PlatformOperator {
  userId: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  /** No sign-in yet  still activating via their set-password link. */
  pending: boolean;
  createdAt: string;
}

/** Every platform operator (super-admin), newest first, with 2FA + pending state. */
export async function listPlatformOperatorsDb(): Promise<PlatformOperator[]> {
  const db = getDb();
  const [rows, sessions] = await Promise.all([
    db.select({ id: user.id, name: user.name, email: user.email, tf: user.twoFactorEnabled, createdAt: user.createdAt })
      .from(user).where(eq(user.platformRole, "super_admin")),
    db.select({ userId: session.userId }).from(session),
  ]);
  const hasSession = new Set(sessions.map((s) => s.userId));
  return rows
    .map((r) => ({ userId: r.id, name: r.name, email: r.email, twoFactorEnabled: Boolean(r.tf), pending: !hasSession.has(r.id), createdAt: r.createdAt.toISOString() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether a user is a super-admin who has never signed in (a fresh operator invite). */
export async function isFreshOperatorInviteDb(userId: string): Promise<boolean> {
  const db = getDb();
  const [[u], [s]] = await Promise.all([
    db.select({ role: user.platformRole }).from(user).where(eq(user.id, userId)).limit(1),
    db.select({ id: session.id }).from(session).where(eq(session.userId, userId)).limit(1),
  ]);
  return u?.role === "super_admin" && !s;
}

/** Invite a platform operator: provision (or promote) a super-admin + a credential account. */
export async function invitePlatformOperatorDb(name: string, email: string, now: string): Promise<{ userId: string; email: string; existing: boolean }> {
  const db = getDb();
  const [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  const userId = found?.id ?? `user_op_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  if (!found) {
    await db.insert(user).values({ id: userId, name, email, emailVerified: true, platformRole: "super_admin", createdAt: new Date(now), updatedAt: new Date(now) });
    const placeholder = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`);
    await db.insert(account).values({ id: `acct_${userId}`, accountId: userId, providerId: "credential", userId, password: placeholder, createdAt: new Date(now), updatedAt: new Date(now) }).onConflictDoNothing();
  } else {
    // Promote an existing user to operator.
    await db.update(user).set({ platformRole: "super_admin", updatedAt: new Date(now) }).where(eq(user.id, userId));
  }
  return { userId, email, existing: Boolean(found) };
}

/** Revoke a user's platform-operator access (clears the super-admin role). */
export async function revokePlatformOperatorDb(userId: string): Promise<{ ok: boolean }> {
  const res = await getDb().update(user).set({ platformRole: null, updatedAt: new Date() })
    .where(and(eq(user.id, userId), eq(user.platformRole, "super_admin")))
    .returning({ id: user.id });
  return { ok: res.length > 0 };
}

/** An operator's email (for resending their setup link). */
export async function getOperatorEmailDb(userId: string): Promise<string | null> {
  const [u] = await getDb().select({ email: user.email }).from(user).where(and(eq(user.id, userId), eq(user.platformRole, "super_admin"))).limit(1);
  return u?.email ?? null;
}
