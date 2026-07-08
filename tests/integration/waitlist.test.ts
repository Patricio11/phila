import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W7 waitlist — when a slot frees up, matching waiting entries (same counsellor or
 * counsellor-agnostic) are offered it and marked; a mismatched counsellor is skipped.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { offerFreedSlotDb, listWaitlistDb } = await import("@/db/queries/waitlist");

const ORG = "org_wl_probe";

afterAll(async () => {
  await sql`DELETE FROM waitlist_entries WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("waitlist auto-offer", () => {
  it("offers a freed slot to matching entries, marks them, and skips a different counsellor", { timeout: 20_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, created_at)
      VALUES (${ORG}, 'Waitlist Probe', 'wl-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`DELETE FROM waitlist_entries WHERE org_id=${ORG}`;
    await sql`INSERT INTO waitlist_entries (id, org_id, client_id, counsellor_id, status, created_at) VALUES
      ('wl_p_a', ${ORG}, 'cl_a', 'couns_x', 'waiting', now() - interval '3 days'),
      ('wl_p_b', ${ORG}, 'cl_b', null,      'waiting', now() - interval '1 day'),
      ('wl_p_c', ${ORG}, 'cl_c', 'couns_y', 'waiting', now())`;

    // A slot with couns_x frees → the couns_x entry + the any-counsellor entry match (oldest first).
    const offered = await offerFreedSlotDb(ORG, "couns_x");
    expect(offered.map((o) => o.clientId)).toEqual(["cl_a", "cl_b"]);

    // Those two are marked offered; the couns_y entry is untouched.
    const rows = await sql`SELECT id, offered_at FROM waitlist_entries WHERE org_id=${ORG} ORDER BY id`;
    const offeredAt = Object.fromEntries(rows.map((r) => [r.id, r.offered_at]));
    expect(offeredAt.wl_p_a).not.toBeNull();
    expect(offeredAt.wl_p_b).not.toBeNull();
    expect(offeredAt.wl_p_c).toBeNull();

    // Still all "waiting" (an offer doesn't place them); the list read works RLS-scoped.
    const list = await listWaitlistDb(ORG);
    expect(list.length).toBe(3);
  });
});
