import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

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
 * short transaction, sets the org GUC locally, runs its queries, and commits.
 * That avoids holding a connection open across an entire RSC render (which could
 * span a multi-second AI/LLM call) while still guaranteeing every query in the
 * operation sees the same tenant context.
 */

/** The tenant context for the current async request, set by the auth guards. */
export interface OrgContext {
  /** The caller's org, or null for a super-admin (who uses `isSuper`). */
  orgId: string | null;
  /** Platform super-admin — the RLS policies let this cross orgs, still audited. */
  isSuper: boolean;
}

const store = new AsyncLocalStorage<OrgContext>();

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

/**
 * Declare the tenant context for the rest of the current request. Called by the
 * auth guards once they've resolved the principal + membership. Uses `enterWith`
 * so no callback-wrapping is needed — the context is request-local (each request
 * runs in its own async context) and read by `runScoped` below.
 */
export function enterOrgContext(ctx: OrgContext): void {
  store.enterWith(ctx);
}

/** The current tenant context, or null if none has been entered (e.g. bootstrap). */
export function getOrgContext(): OrgContext | null {
  return store.getStore() ?? null;
}

/** Run `fn` with an explicit context (mainly for tests + one-off elevated ops). */
export function withOrgContext<T>(ctx: OrgContext, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

export type ScopedDb = Parameters<Parameters<ReturnType<typeof getAppDb>["transaction"]>[0]>[0];

/**
 * Run a unit of DB work as `phila_app`, scoped to the current org context. Opens a
 * short transaction, sets `app.org_id` / `app.is_super` locally, then runs `fn`.
 * **Fails closed:** with no context entered, it throws rather than run unscoped.
 * Keep `fn` free of external (non-DB) awaits so the transaction stays short.
 */
export async function runScoped<T>(fn: (db: ScopedDb) => Promise<T>): Promise<T> {
  const ctx = store.getStore();
  if (!ctx) {
    throw new Error(
      "runScoped() called with no org context. A guard must call enterOrgContext() first (or use the owner connection for a bootstrap/cross-org path).",
    );
  }
  return getAppDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.is_super', ${ctx.isSuper ? "on" : "off"}, true)`);
    return fn(tx);
  });
}
