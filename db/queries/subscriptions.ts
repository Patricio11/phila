import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeDb } from "@/lib/db/scoped";
import { subscriptions, payments } from "@/db/schema";

/** An org's Phila plan subscription (Phase 15A). */
export interface SubRow {
  orgId: string;
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
}

export async function getSubscriptionRow(orgId: string): Promise<SubRow | null> {
  // activeDb(): the RLS-scoped tx when called inside runForOrg (hub billing/settings),
  // else the owner connection  so this read is safe from either kind of caller.
  const [r] = await activeDb().select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!r) return null;
  return { orgId: r.orgId, planId: r.planId, status: r.status, currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null };
}

export async function listSubscriptions(): Promise<SubRow[]> {
  const rows = await getDb().select().from(subscriptions);
  return rows.map((r) => ({ orgId: r.orgId, planId: r.planId, status: r.status, currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null }));
}

export async function upsertSubscription(orgId: string, planId: string, status: string, currentPeriodEnd: Date | null, providerRef?: string): Promise<void> {
  const now = new Date();
  await getDb().insert(subscriptions).values({ orgId, planId, status, currentPeriodEnd, providerRef, updatedAt: now })
    .onConflictDoUpdate({ target: subscriptions.orgId, set: { planId, status, currentPeriodEnd, providerRef, updatedAt: now } });
}

/** Idempotent: the first paid subscription charge activates the plan; replays no-op. */
export async function settleSubscription(providerRef: string): Promise<{ active: boolean; planId: string | null }> {
  const db = getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.providerRef, providerRef)).limit(1);
  if (!pay || pay.purpose !== "subscription" || !pay.packId) return { active: false, planId: pay?.packId ?? null };
  if (pay.status === "paid") return { active: false, planId: pay.packId };
  await db.update(payments).set({ status: "paid", paidAt: new Date() }).where(eq(payments.providerRef, providerRef));
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await upsertSubscription(pay.orgId, pay.packId, "active", periodEnd, providerRef);
  return { active: true, planId: pay.packId };
}
