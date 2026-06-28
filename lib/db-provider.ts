/**
 * dbProvider — the Part-B implementation of the `dataProvider` seam, backed by
 * Neon Postgres. It is built as a **hybrid migration layer**: it spreads
 * `mockProvider` as the base, then overrides one method at a time with a real DB
 * read/write. Methods not yet migrated fall back to the mock — and because the DB
 * is seeded from the same fixtures, mock-fallback and real reads return identical
 * data, so the app stays whole while it goes real (Phase 9 → Phase 17).
 *
 * Identity is already real: the session/guards resolve the principal from
 * `org_members` + `user` (lib/auth/session.ts). RLS becomes the tenant boundary
 * as the write paths migrate (docs/SECURITY.md).
 */
import { eq } from "drizzle-orm";
import type { DataProvider } from "@/lib/data-provider";
import type { Org } from "@/lib/domain/types";
import { mockProvider } from "@/lib/mock/provider";
import { getDb } from "@/db/client";
import { orgs as orgsTable } from "@/db/schema";

type OrgRow = typeof orgsTable.$inferSelect;

/** Map a DB org row → the domain `Org` shape the app codes against. */
function toOrg(row: OrgRow): Org {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandAccent: row.brandAccent,
    province: row.province as Org["province"],
    timezone: "Africa/Johannesburg",
    features: row.features as Org["features"],
    scheduling: row.scheduling as unknown as Org["scheduling"],
  };
}

export const dbProvider: DataProvider = {
  ...mockProvider,

  // ── Real (DB-backed) ──────────────────────────────────────────────────
  getOrg: async (orgId: string): Promise<Org | null> => {
    const db = getDb();
    const [row] = await db.select().from(orgsTable).where(eq(orgsTable.id, orgId)).limit(1);
    return row && !row.deletedAt ? toOrg(row) : null;
  },

  getOrgBySlug: async (slug: string): Promise<Org | null> => {
    const db = getDb();
    const [row] = await db.select().from(orgsTable).where(eq(orgsTable.slug, slug)).limit(1);
    return row && !row.deletedAt ? toOrg(row) : null;
  },
};
