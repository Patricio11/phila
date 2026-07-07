import type { Plan } from "@/lib/domain/types";

/**
 * Phila plan catalogue (Phase 15A)  the product's subscription tiers. This is the
 * canonical source (shared client + server); an org's chosen plan lives in the
 * `subscriptions` table. Prices in ZAR cents / month.
 */
export const PLANS: Plan[] = [
  { id: "p_community", name: "Community", tagline: "For NGOs, faith-based & community services", priceCents: 65000, seats: 8, aiTokens: 50000, videoMinutes: 300, messaging: true, rooms: 5, storageGb: 10, ngo: true },
  { id: "p_practice", name: "Practice", tagline: "For a growing private practice", priceCents: 120000, seats: 5, aiTokens: 0, videoMinutes: 0, messaging: false, rooms: 3, storageGb: 5 },
  { id: "p_programme", name: "Programme", tagline: "For multi-counsellor programmes & EAPs", priceCents: 350000, seats: 15, aiTokens: 100000, videoMinutes: 600, messaging: true, rooms: 10, storageGb: 50, popular: true },
  { id: "p_enterprise", name: "Enterprise", tagline: "For large EAPs & provider networks", priceCents: 750000, seats: null, aiTokens: 500000, videoMinutes: 2000, messaging: true, rooms: null, storageGb: 200 },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Whole days left in a trial (0 once it has ended). Pass the app clock as `nowIso`. */
export function trialDaysLeft(endIso: string, nowIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(nowIso).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
