import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10.2 — Row-Level Security proof. Connects as the non-owner `phila_app`
 * role (no BYPASSRLS) and shows the policies are a real, enforced tenant boundary:
 *  - deny-by-default with no org context set
 *  - an org sees only its own rows, never another org's
 *  - cross-org writes are rejected by the WITH CHECK clause
 *  - the audited super-admin path sees across orgs
 *
 * Skips cleanly if DATABASE_URL_APP isn't configured (e.g. CI without the role).
 */
const env = readFileSync(".env.local", "utf8");
const OWNER = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim() ?? "";
const APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim() ?? "";

const owner = neon(OWNER);
const app = neon(APP);
const OTHER_ORG = "org_rls_probe";
const OTHER_CLIENT = "cl_rls_probe";

describe.skipIf(!APP)("RLS isolation (as phila_app)", () => {
  beforeAll(async () => {
    // A second tenant, created by the owner (bypasses RLS).
    await owner`INSERT INTO orgs (id, name, slug, province, timezone, brand_accent)
      VALUES (${OTHER_ORG}, 'RLS Probe Org', 'rls-probe', 'Gauteng', 'Africa/Johannesburg', '#2f6f4f')
      ON CONFLICT (id) DO NOTHING`;
    await owner`INSERT INTO clients (id, org_id, name, province, risk_flag, created_at)
      VALUES (${OTHER_CLIENT}, ${OTHER_ORG}, 'Probe Client', 'Gauteng', false, now())
      ON CONFLICT (id) DO NOTHING`;
  });

  afterAll(async () => {
    await owner`DELETE FROM clients WHERE id = ${OTHER_CLIENT}`;
    await owner`DELETE FROM orgs WHERE id = ${OTHER_ORG}`;
  });

  it("denies all rows when no org context is set", async () => {
    const rows = await app`SELECT count(*)::int AS n FROM clients`;
    expect(rows[0]!.n).toBe(0);
  });

  it("sees only the caller's org, never another org's", async () => {
    const [withinMz, leak] = await app.transaction([
      app`SELECT set_config('app.org_id', 'org_masizakhe', true)`,
      app`SELECT count(*)::int AS n FROM clients`,
    ]).then(() => app.transaction([
      app`SELECT set_config('app.org_id', 'org_masizakhe', true)`,
      app`SELECT count(*)::int AS n FROM clients WHERE id = ${OTHER_CLIENT}`,
    ]));
    void withinMz;
    // Masizakhe context cannot see the probe org's client.
    expect(leak[0]!.n).toBe(0);

    // The probe org's own context sees exactly its one client.
    const own = await app.transaction([
      app`SELECT set_config('app.org_id', ${OTHER_ORG}, true)`,
      app`SELECT count(*)::int AS n FROM clients`,
    ]);
    expect(own[1]![0]!.n).toBe(1);
  });

  it("sees masizakhe rows within masizakhe context", async () => {
    const res = await app.transaction([
      app`SELECT set_config('app.org_id', 'org_masizakhe', true)`,
      app`SELECT count(*)::int AS n FROM clients`,
    ]);
    expect(res[1]![0]!.n).toBeGreaterThan(0);
  });

  it("rejects a cross-org write (WITH CHECK)", async () => {
    await expect(
      app.transaction([
        app`SELECT set_config('app.org_id', 'org_masizakhe', true)`,
        app`INSERT INTO clients (id, org_id, name, province, risk_flag, created_at)
            VALUES ('cl_evil', ${OTHER_ORG}, 'Evil', 'Gauteng', false, now())`,
      ]),
    ).rejects.toThrow();
  });

  it("super-admin context sees across orgs", async () => {
    const res = await app.transaction([
      app`SELECT set_config('app.is_super', 'on', true)`,
      app`SELECT count(DISTINCT org_id)::int AS orgs FROM clients`,
    ]);
    expect(res[1]![0]!.orgs).toBeGreaterThanOrEqual(2);
  });
});
