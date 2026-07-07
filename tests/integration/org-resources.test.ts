import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W3.4/3.5 — moving an org between plans changes its quotas; a per-org storage
 * override wins over the plan; the resource meters read the real pools.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { setOrgPlanDb, orgStorageLimitBytes, setOrgStorageLimitDb, getOrgResourceMetersDb } = await import("@/db/queries/resources");
const { planById } = await import("@/lib/billing/plans");

// A dedicated probe org so we never mutate a shared tenant's plan (parallel-safe).
const ORG = "org_res_probe";
const GB = 1024 ** 3;

afterAll(async () => {
  await sql`DELETE FROM subscriptions WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("plan + resource meters", () => {
  it("moves an org between plans and honours a storage override", { timeout: 20_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, resource_limits, created_at)
      VALUES (${ORG}, 'Resource Probe', 'resource-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET resource_limits='{}'::jsonb`;
    await sql`INSERT INTO subscriptions (org_id, plan_id, status, updated_at) VALUES (${ORG}, 'p_community', 'active', now())
      ON CONFLICT (org_id) DO UPDATE SET plan_id='p_community'`;

    // Move to Practice (5 GB) → storage limit follows the plan.
    await setOrgPlanDb(ORG, "p_practice");
    expect(await orgStorageLimitBytes(ORG)).toBe(planById("p_practice")!.storageGb * GB);

    // Move to Enterprise (200 GB).
    await setOrgPlanDb(ORG, "p_enterprise");
    expect(await orgStorageLimitBytes(ORG)).toBe(200 * GB);

    // A per-org override wins over the plan.
    await setOrgStorageLimitDb(ORG, 500);
    expect(await orgStorageLimitBytes(ORG)).toBe(500 * GB);

    // Meters report the effective numbers.
    const meters = await getOrgResourceMetersDb(ORG);
    expect(meters.planName).toBe("Enterprise");
    expect(meters.storage.limitBytes).toBe(500 * GB);
    expect(meters.storage.overridden).toBe(true);
    expect(typeof meters.ai.capCents).toBe("number");

    // Clearing the override falls back to the plan.
    await setOrgStorageLimitDb(ORG, null);
    expect(await orgStorageLimitBytes(ORG)).toBe(200 * GB);
  });
});
