import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

/**
 * Workstream 0.2  proves the *application's* RLS mechanism, `runScoped`
 * (`lib/db/scoped.ts`), isolates tenants. The sibling `rls.test.ts` proves the
 * Postgres policies with raw SQL; this proves the code path the app actually runs:
 * the `phila_app` pool + the org GUC set from an explicit context.
 *
 * Requires DATABASE_URL_APP + an applied `db/rls.sql`. Seeded org: `org_masizakhe`.
 */
const env = readFileSync(".env.local", "utf8");
const APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim() ?? "";
process.env.DATABASE_URL_APP = APP;

const { runScoped, runForOrg } = await import("@/lib/db/scoped");

const countIn = (orgId: string, table: "clients" | "orgs") =>
  runForOrg(orgId, async (db) => {
    const r = await db.execute(sql.raw(`select count(*)::int as n from ${table}`));
    return Number((r.rows[0] as { n: number }).n);
  });

describe.skipIf(!APP)("runScoped RLS enforcement (phila_app request path)", () => {
  it("sees its own org's rows, and only its own org row", async () => {
    expect(await countIn("org_masizakhe", "clients")).toBeGreaterThan(0);
    expect(await countIn("org_masizakhe", "orgs")).toBe(1);
  });

  it("sees nothing when scoped to a different org (deny-by-default)", async () => {
    expect(await countIn("org_does_not_exist", "clients")).toBe(0);
    expect(await countIn("org_does_not_exist", "orgs")).toBe(0);
  });

  it("lets a super-admin context cross orgs", async () => {
    const orgs = await runScoped({ orgId: null, isSuper: true }, async (db) => {
      const r = await db.execute(sql.raw(`select count(*)::int as n from orgs`));
      return Number((r.rows[0] as { n: number }).n);
    });
    expect(orgs).toBeGreaterThan(1);
  });
});
