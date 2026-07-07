import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { plans as plansTable } from "@/db/schema";
import { PLANS } from "@/lib/billing/plans";
import type { Plan } from "@/lib/domain/types";

/**
 * The subscription plan catalogue, DB-backed + super-admin-editable (W3.4). The code
 * `PLANS` stays as the seed + fallback: if the table is empty/unavailable (fresh DB,
 * mock, tests that import the constant), reads fall back to it — so nothing breaks.
 */
function toPlan(r: typeof plansTable.$inferSelect): Plan {
  return {
    id: r.id, name: r.name, tagline: r.tagline, priceCents: r.priceCents,
    seats: r.seats, aiTokens: r.aiTokens, videoMinutes: r.videoMinutes, messaging: r.messaging,
    rooms: r.rooms, storageGb: r.storageGb,
    ...(r.popular ? { popular: true } : {}),
    ...(r.ngo ? { ngo: true } : {}),
  };
}

/** The live plan catalogue (active plans, ordered). Falls back to the code defaults. */
export async function getPlansDb(): Promise<Plan[]> {
  try {
    const rows = await getDb().select().from(plansTable).where(eq(plansTable.active, true)).orderBy(asc(plansTable.sortOrder));
    return rows.length ? rows.map(toPlan) : PLANS;
  } catch {
    return PLANS;
  }
}

/** id → Plan, from the live catalogue. */
export async function getPlansMapDb(): Promise<Map<string, Plan>> {
  return new Map((await getPlansDb()).map((p) => [p.id, p]));
}

export async function getPlanByIdDb(id: string): Promise<Plan | undefined> {
  return (await getPlansMapDb()).get(id);
}

/** Upsert a plan's editable fields (super-admin). */
export async function savePlanDb(plan: Plan): Promise<void> {
  await getDb().insert(plansTable).values({
    id: plan.id, name: plan.name, tagline: plan.tagline, priceCents: plan.priceCents,
    seats: plan.seats, aiTokens: plan.aiTokens, videoMinutes: plan.videoMinutes, messaging: plan.messaging,
    rooms: plan.rooms, storageGb: plan.storageGb, popular: Boolean(plan.popular), ngo: Boolean(plan.ngo),
  }).onConflictDoUpdate({
    target: plansTable.id,
    set: {
      name: plan.name, tagline: plan.tagline, priceCents: plan.priceCents, seats: plan.seats,
      aiTokens: plan.aiTokens, videoMinutes: plan.videoMinutes, messaging: plan.messaging,
      rooms: plan.rooms, storageGb: plan.storageGb, popular: Boolean(plan.popular), ngo: Boolean(plan.ngo),
    },
  });
}
