import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgs, subscriptions } from "@/db/schema";
import { getCreditBalances } from "@/db/queries/messaging";
import { currentStorageBytes } from "@/db/queries/documents";
import { getAiSpendThisMonth, getAiSettings } from "@/db/queries/ai";
import { getSubscriptionRow } from "@/db/queries/subscriptions";
import { planById } from "@/lib/billing/plans";
import { BYTES_PER_GB, DEFAULT_STORAGE_GB } from "@/lib/documents/quota";

/**
 * Plan assignment + metered resources (W3.4/3.5). Reuses what's already real —
 * credits (`credit_balances`), storage (`org_storage_usage`), and AI usage/cap
 * (`ai_usage` + `org_ai_settings`) — and adds the super-admin's plan move and a
 * per-org storage-limit override (`orgs.resource_limits`).
 */

/** Move an org between plans — the resolver + quotas reflect it immediately. */
export async function setOrgPlanDb(orgId: string, planId: string): Promise<{ ok: boolean }> {
  const existing = await getSubscriptionRow(orgId);
  if (existing) {
    await getDb().update(subscriptions).set({ planId, updatedAt: new Date() }).where(eq(subscriptions.orgId, orgId));
  } else {
    await getDb().insert(subscriptions).values({ orgId, planId, status: "active", currentPeriodEnd: null, providerRef: "admin", updatedAt: new Date() });
  }
  return { ok: true };
}

/** The org's effective storage ceiling in bytes: override → plan → default. */
export async function orgStorageLimitBytes(orgId: string): Promise<number> {
  const db = getDb();
  const [[org], sub] = await Promise.all([
    db.select({ rl: orgs.resourceLimits }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
    getSubscriptionRow(orgId),
  ]);
  const override = (org?.rl as Record<string, number> | undefined)?.storageGb;
  const planGb = planById(sub?.planId ?? "p_community")?.storageGb ?? DEFAULT_STORAGE_GB;
  return (override ?? planGb) * BYTES_PER_GB;
}

/** Set (or clear, with null) a per-org storage-limit override in GB. */
export async function setOrgStorageLimitDb(orgId: string, gb: number | null): Promise<void> {
  const db = getDb();
  const [org] = await db.select({ rl: orgs.resourceLimits }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  const rl = { ...((org?.rl as Record<string, number> | undefined) ?? {}) };
  if (gb === null) delete rl.storageGb; else rl.storageGb = gb;
  await db.update(orgs).set({ resourceLimits: rl }).where(eq(orgs.id, orgId));
}

export interface OrgResourceMeters {
  planName: string;
  planId: string;
  smsCredits: number;
  emailCredits: number;
  storage: { usedBytes: number; limitBytes: number; overridden: boolean };
  ai: { spentCents: number; capCents: number };
}

/** Everything the admin resources panel shows, from the real meters. */
export async function getOrgResourceMetersDb(orgId: string): Promise<OrgResourceMeters> {
  const db = getDb();
  const [credits, usedBytes, spentCents, aiSettings, orgRows, sub] = await Promise.all([
    getCreditBalances(orgId),
    currentStorageBytes(orgId),
    getAiSpendThisMonth(orgId),
    getAiSettings(orgId),
    db.select({ rl: orgs.resourceLimits }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
    getSubscriptionRow(orgId),
  ]);
  const rl = (orgRows[0]?.rl as Record<string, number> | undefined) ?? {};
  const plan = planById(sub?.planId ?? "p_community");
  const storageGb = rl.storageGb ?? plan?.storageGb ?? DEFAULT_STORAGE_GB;
  return {
    planName: plan?.name ?? "",
    planId: sub?.planId ?? "p_community",
    smsCredits: credits.sms,
    emailCredits: credits.email,
    storage: { usedBytes, limitBytes: storageGb * BYTES_PER_GB, overridden: rl.storageGb !== undefined },
    ai: { spentCents, capCents: aiSettings.monthlyCapCents },
  };
}
