import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

/**
 * Workstream 0.2 — proves the *application's* RLS mechanism, `runScoped`
 * (`lib/db/scoped.ts`), isolates tenants. The sibling `rls.test.ts` proves the
 * Postgres policies with raw SQL; this proves the code path the app actually runs:
 * the `phila_app` pool + the org GUC set from the AsyncLocalStorage context.
 *
 * Requires DATABASE_URL_APP + an applied `db/rls.sql`. Seeded org: `org_masizakhe`.
 */
const env = readFileSync(".env.local", "utf8");
const APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim() ?? "";
process.env.DATABASE_URL_APP = APP;

const { runScoped, withOrgContext } = await import("@/lib/db/scoped");

const count = (table: "clients" | "orgs") =>
  runScoped(async (db) => {
    const r = await db.execute(sql.raw(`select count(*)::int as n from ${table}`));
    return Number((r.rows[0] as { n: number }).n);
  });

describe.skipIf(!APP)("runScoped RLS enforcement (phila_app request path)", () => {
  it("sees its own org's rows, and only its own org row", async () => {
    const clients = await withOrgContext({ orgId: "org_masizakhe", isSuper: false }, () => count("clients"));
    const orgs = await withOrgContext({ orgId: "org_masizakhe", isSuper: false }, () => count("orgs"));
    expect(clients).toBeGreaterThan(0);
    expect(orgs).toBe(1);
  });

  it("sees nothing when scoped to a different org (deny-by-default)", async () => {
    const clients = await withOrgContext({ orgId: "org_does_not_exist", isSuper: false }, () => count("clients"));
    const orgs = await withOrgContext({ orgId: "org_does_not_exist", isSuper: false }, () => count("orgs"));
    expect(clients).toBe(0);
    expect(orgs).toBe(0);
  });

  it("lets a super-admin context cross orgs", async () => {
    const orgs = await withOrgContext({ orgId: null, isSuper: true }, () => count("orgs"));
    expect(orgs).toBeGreaterThan(1);
  });

  it("fails closed: no context → throws, never runs unscoped", async () => {
    await expect(count("clients")).rejects.toThrow(/no org context/i);
  });
});
