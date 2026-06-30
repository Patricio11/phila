import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Phase 16  the real analytics layer computes from the seeded clinical data. */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();

import { neon } from "@neondatabase/serverless";
import { getReportingDb, getHubInsightsDb } from "@/db/queries/analytics";
import { listGrantsDb, getGrantViewDb, getFunderGrantViewDb, postGrantNarrativeDb } from "@/db/queries/grants";

const sql = neon(process.env.DATABASE_URL!);

const ORG = "org_masizakhe";
const NOW = "2026-06-30T09:00:00+02:00";

describe("reporting + insights", () => {
  it("reporting computes consented breakdowns + headline (k-anon safe)", async () => {
    const r = await getReportingDb(ORG, NOW, {});
    expect(r.totalClients).toBeGreaterThan(0);
    expect(Array.isArray(r.byGender)).toBe(true);
    expect(Array.isArray(r.headline)).toBe(true);
    expect(typeof r.improvementRate).toBe("number");
    // every cell is either a real count or labelled suppressed
    for (const b of r.byProvince) expect(b.suppressed === (b.count === null)).toBe(true);
  });

  it("insights computes the window + a previous comparable window", async () => {
    const i = await getHubInsightsDb(ORG, NOW, { period: "month" });
    expect(i.byDay).toHaveLength(7);
    expect(i.byMonth).toHaveLength(6);
    expect(i.previous).toBeDefined();
    expect(typeof i.attendanceRate).toBe("number");
  });
});

describe("grants + funder scope", () => {
  it("lists grants and computes a grant view with indicators + headline", async () => {
    const grants = await listGrantsDb(ORG);
    expect(grants.length).toBeGreaterThanOrEqual(1);
    const view = await getGrantViewDb("g_dsd", NOW);
    expect(view).not.toBeNull();
    expect(view!.indicators.length).toBeGreaterThanOrEqual(1);
    expect(view!.allocatedCount).toBeGreaterThan(0);
    expect(typeof view!.headline).toBe("string");
    // unique_clients indicator actual == allocatedCount
    const uc = view!.indicators.find((x) => x.indicator.metric === "unique_clients");
    if (uc) expect(uc.actual).toBe(view!.allocatedCount);
  });

  it("funder reaches only their scoped grant", async () => {
    const ok = await getFunderGrantViewDb("user_funder", "g_dsd", NOW);
    expect(ok).not.toBeNull();
    const denied = await getFunderGrantViewDb("user_funder", "g_lotto", NOW);
    expect(denied).toBeNull();
  });

  it("persists a narrative the funder can then see", async () => {
    const body = "Test update p16-narrative-roundtrip";
    await postGrantNarrativeDb("g_dsd", "Test Author", body);
    const view = await getFunderGrantViewDb("user_funder", "g_dsd", NOW);
    expect(view!.narratives.some((n) => n.body === body)).toBe(true);
    await sql`DELETE FROM grant_narratives WHERE author = 'Test Author' AND body = ${body}`;
  });
});
