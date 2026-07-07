import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W3 — the entitlement resolver precedence: platform kill-switch → per-org override →
 * plan → the org's own toggle. Exercised against org_masizakhe (snapshot + restore).
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { resolveFeatureDb, setPlatformFeatureDb, setOrgFeatureOverrideDb } = await import("@/db/queries/features");

const ORG = "org_masizakhe";
let originalFeatures = "";

afterAll(async () => {
  if (originalFeatures) await sql`UPDATE orgs SET features = ${originalFeatures}::jsonb WHERE id=${ORG}`;
  await sql`DELETE FROM platform_feature_flags WHERE feature='ai'`;
  await sql`DELETE FROM org_feature_overrides WHERE org_id=${ORG} AND feature='ai'`;
});

describe("feature entitlement resolver", () => {
  it("applies the precedence chain for a feature the plan includes", { timeout: 20_000 }, async () => {
    const [row] = await sql`SELECT features::text AS f FROM orgs WHERE id=${ORG}`;
    originalFeatures = row!.f as string;

    // Baseline: the practice turns AI on; no override, no kill. (Community plan includes AI.)
    await sql`UPDATE orgs SET features = jsonb_set(features, '{ai}', 'true') WHERE id=${ORG}`;
    await sql`DELETE FROM platform_feature_flags WHERE feature='ai'`;
    await sql`DELETE FROM org_feature_overrides WHERE org_id=${ORG} AND feature='ai'`;
    let r = await resolveFeatureDb(ORG, "ai");
    expect(r.enabled).toBe(true);
    expect(r.source).toBe("self");
    expect(r.orgControllable).toBe(true);

    // Platform kill-switch wins over everything.
    await setPlatformFeatureDb("ai", true);
    r = await resolveFeatureDb(ORG, "ai");
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("platform");
    await setPlatformFeatureDb("ai", false);

    // Per-org force_off suspends it.
    await setOrgFeatureOverrideDb(ORG, "ai", "force_off", "billing dispute", "test");
    r = await resolveFeatureDb(ORG, "ai");
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("override");

    // Per-org force_on grants it even when the practice's own toggle is off.
    await sql`UPDATE orgs SET features = jsonb_set(features, '{ai}', 'false') WHERE id=${ORG}`;
    await setOrgFeatureOverrideDb(ORG, "ai", "force_on", "beta", "test");
    r = await resolveFeatureDb(ORG, "ai");
    expect(r.enabled).toBe(true);
    expect(r.source).toBe("override");

    // Back to inherit → follows the (now-off) self-toggle.
    await setOrgFeatureOverrideDb(ORG, "ai", "inherit", null, "test");
    r = await resolveFeatureDb(ORG, "ai");
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("self");
  });
});
