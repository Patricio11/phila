import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.7  the super-admin console reads every tenant from the real tables (orgs,
 * subscriptions, org_members, appointments, ai_usage, audit_log) and the onboarding
 * review persists. No fixture.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

import {
  getPlatformOverviewDb, listPlatformOrgsDb, getPlatformOrgDetailDb, listPlatformAuditDb,
  listOrgSlugsDb, listOnboardingRequirementsDb, getOrgOnboardingReviewDb, reviewOnboardingDocDb,
} from "@/db/queries/platform";

// Restore the one onboarding cell we flip.
let restore: { status: string } | null = null;
afterAll(async () => {
  if (restore) {
    await sql`UPDATE org_onboarding_docs SET status=${restore.status} WHERE org_id='org_masizakhe' AND requirement_id='popia'`;
  }
});

describe("platform overview & orgs", () => {
  it("computes overview + org rows from the real tenants", async () => {
    const overview = await getPlatformOverviewDb();
    expect(overview.orgCount).toBeGreaterThanOrEqual(5); // masizakhe + the 4 seeded tenants
    expect(overview.totalMembers).toBeGreaterThan(0);
    expect(overview.mrrCents).toBeGreaterThan(0);

    const rows = await listPlatformOrgsDb();
    const thrive = rows.find((r) => r.org.id === "org_thrive");
    expect(thrive).toBeTruthy();
    expect(thrive!.org.subscriptionStatus).toBe("active");
    expect(thrive!.org.members).toBeGreaterThan(0);
    expect(thrive!.org.aiSpendCents).toBeGreaterThan(0);
    expect(thrive!.planName).toBe("Enterprise");

    const khula = rows.find((r) => r.org.id === "org_khula");
    expect(khula!.org.suspended).toBe(true); // cancelled → suspended
  });

  it("returns org detail with a team + client count", async () => {
    const detail = await getPlatformOrgDetailDb("org_masizakhe");
    expect(detail).toBeTruthy();
    expect(detail!.team.length).toBeGreaterThan(0);
    expect(detail!.fullyModeled).toBe(true);
    expect(await getPlatformOrgDetailDb("org_nope")).toBeNull();
  });
});

describe("platform audit & slugs", () => {
  it("reads recent audit events joined to org + actor", async () => {
    const events = await listPlatformAuditDb(10);
    expect(Array.isArray(events)).toBe(true);
    // Ordered newest-first.
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1]!.at >= events[i]!.at).toBe(true);
    }
  });

  it("lists live org slugs (public micro-site params)", async () => {
    const slugs = await listOrgSlugsDb();
    expect(slugs).toContain("masizakhe");
    expect(slugs.length).toBeGreaterThanOrEqual(5);
  });
});

describe("onboarding", () => {
  it("lists the checklist and reviews an org's document", async () => {
    const reqs = await listOnboardingRequirementsDb();
    expect(reqs.map((r) => r.id)).toContain("hpcsa");

    const before = await getOrgOnboardingReviewDb("org_masizakhe");
    const popia = before.docs.find((d) => d.requirementId === "popia");
    restore = { status: popia!.status };

    const res = await reviewOnboardingDocDb("org_masizakhe", "popia", "verify");
    expect(res.ok).toBe(true);
    const after = await getOrgOnboardingReviewDb("org_masizakhe");
    expect(after.docs.find((d) => d.requirementId === "popia")!.status).toBe("verified");
  });
});
