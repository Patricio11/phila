import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration. No live connection is required in Part A; the
 * commands (`db:generate` / `db:migrate` / `db:push` / `db:studio`) operate once
 * `DATABASE_URL` is set in Phase 10. Migrations live in `db/migrations` with a
 * journal committed in the same change (Migration convention).
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/phila_dev" },
  strict: true,
  verbose: true,
});
