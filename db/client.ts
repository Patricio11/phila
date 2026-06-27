import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

/**
 * Drizzle client over Neon Postgres. Driver-agnostic by design: the EU→SA
 * residency migration before public launch is a change to this file only
 * (Data-Residency Rule). In Part A there is **no live connection**  the client
 * is created lazily and only when `DATABASE_URL` is set, so importing it never
 * forces a connection. The real isolation boundary is Postgres RLS (Phase 10).
 */
let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "DATABASE_URL is not set. Part A runs on the mock provider (DATA_PROVIDER=mock); the DB lights up in Phase 10.",
    );
  cached = drizzle(neon(url), { schema });
  return cached;
}
