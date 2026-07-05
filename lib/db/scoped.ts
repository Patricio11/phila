import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "@/db/schema";
import { getDb } from "@/db/client";

/**
 * RLS-scoped database access (Workstream 0.2 — the runtime cutover).
 *
 * The owner connection (`db/client.ts`, `neondb_owner`) has BYPASSRLS and is used
 * for bootstrapping (session/membership resolution), webhooks, cron, and seed.
 * The *request* path instead runs as the non-owner `phila_app` role (no BYPASSRLS)
 * through this module, so Postgres RLS (`db/rls.sql`) is a real second boundary
 * beneath the app-layer `where org_id = …` checks — defence in depth.
 *
 * We scope **per operation**, not per request: each `runScoped` call opens one
 * short transaction, sets the org GUC locally, runs its queries, and commits — so
 * we never hold a connection across a whole RSC render (which could span a
 * multi-second AI/LLM call). The tenant context is passed **explicitly** (the DAL
 * already has the caller's `orgId`), which is more robust than trying to smuggle
 * it through `AsyncLocalStorage.enterWith` across an awaited guard boundary.
 */

/** The tenant context for a scoped operation. */
export interface OrgContext {
  /** The caller's org, or null for a super-admin (who sets `isSuper`). */
  orgId: string | null;
  /** Platform super-admin — the RLS policies let this cross orgs, still audited. */
  isSuper: boolean;
}

// Node 21+ exposes a global WebSocket; the neon serverless Pool needs it wired.
if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

let pool: Pool | null = null;
let appDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getAppDb() {
  if (appDb) return appDb;
  const url = process.env.DATABASE_URL_APP;
  if (!url) {
    throw new Error(
      "DATABASE_URL_APP is not set. The RLS-scoped request path connects as the non-owner `phila_app` role; set it to that role's connection string.",
    );
  }
  pool = new Pool({ connectionString: url });
  appDb = drizzle(pool, { schema });
  return appDb;
}

export type ScopedDb = Parameters<Parameters<ReturnType<typeof getAppDb>["transaction"]>[0]>[0];

/** The scoped transaction in flight for the current `runScoped`, if any. */
const dbStore = new AsyncLocalStorage<ScopedDb>();

/**
 * The database handle for the current work: the RLS-scoped transaction when inside
 * a `runScoped` call, otherwise the owner connection. This lets shared DAL helpers
 * stay written against one accessor — a migrated (wrapped) call path runs them
 * through `phila_app` with the org GUC set; an unmigrated path runs them on the
 * owner exactly as before (no behaviour change until a method opts in).
 *
 * The scoped tx (neon-serverless) and the owner db (neon-http) share the same
 * drizzle query-builder API, so the cast is safe; only the driver differs.
 */
export function activeDb(): NeonHttpDatabase<typeof schema> {
  const scoped = dbStore.getStore();
  if (scoped) return scoped as unknown as NeonHttpDatabase<typeof schema>;
  return getDb();
}

/**
 * Run a unit of DB work as `phila_app`, scoped to `ctx`. Opens a short transaction,
 * sets `app.org_id` / `app.is_super` locally, publishes the tx as the ambient
 * `activeDb()` (so shared helpers run on it), then runs `fn`. Keep `fn` free of
 * external (non-DB) awaits so the transaction stays short.
 */
export async function runScoped<T>(ctx: OrgContext, fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.is_super', ${ctx.isSuper ? "on" : "off"}, true)`);
    return dbStore.run(tx, () => fn(tx));
  });
}

/** Convenience for the common org-staff case: scope to one org, not super-admin. */
export function runForOrg<T>(orgId: string, fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  return runScoped({ orgId, isSuper: false }, fn);
}
