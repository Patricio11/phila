import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { creditBundles } from "@/db/schema";
import type { CreditPack, CreditChannel } from "@/lib/payments/packs";

/**
 * Phase 33.1 - the credit catalogue, DB-native. Every purchasable bundle
 * (SMS / Email / LivePhila / VoicePhila) is a row the super-admin edits;
 * orgs see exactly what the admin publishes. No hardcoded prices anywhere.
 */

export interface CreditBundleRow extends CreditPack {
  name: string;
  active: boolean;
  sort: number;
}

const toRow = (r: typeof creditBundles.$inferSelect): CreditBundleRow => ({
  id: r.id,
  channel: r.channel as CreditChannel,
  name: r.name,
  credits: r.credits,
  priceCents: r.priceCents,
  popular: r.popular,
  active: r.active,
  sort: r.sort,
});

/** Active bundles for the org-facing purchase UI (sorted per channel). */
export async function listActiveBundlesDb(): Promise<CreditBundleRow[]> {
  const rows = await getDb().select().from(creditBundles)
    .where(eq(creditBundles.active, true))
    .orderBy(asc(creditBundles.channel), asc(creditBundles.sort), asc(creditBundles.priceCents));
  return rows.map(toRow);
}

/** Every bundle - the super-admin catalogue view. */
export async function listAllBundlesDb(): Promise<CreditBundleRow[]> {
  const rows = await getDb().select().from(creditBundles)
    .orderBy(asc(creditBundles.channel), asc(creditBundles.sort), asc(creditBundles.priceCents));
  return rows.map(toRow);
}

/** One ACTIVE bundle by id - what a purchase is allowed to buy. */
export async function activeBundleByIdDb(id: string): Promise<CreditBundleRow | null> {
  const [r] = await getDb().select().from(creditBundles)
    .where(and(eq(creditBundles.id, id), eq(creditBundles.active, true))).limit(1);
  return r ? toRow(r) : null;
}

/** Create or update a bundle (super-admin; the action audits). */
export async function saveBundleDb(input: {
  id: string; channel: CreditChannel; name: string; credits: number; priceCents: number; popular: boolean; sort: number;
}): Promise<void> {
  await getDb().insert(creditBundles).values({ ...input, active: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: creditBundles.id,
      set: { name: input.name, credits: input.credits, priceCents: input.priceCents, popular: input.popular, sort: input.sort, updatedAt: new Date() },
    });
}

export async function setBundleActiveDb(id: string, active: boolean): Promise<void> {
  await getDb().update(creditBundles).set({ active, updatedAt: new Date() }).where(eq(creditBundles.id, id));
}
