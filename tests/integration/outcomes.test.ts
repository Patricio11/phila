import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.2 — recording a PHQ-9/GAD-7 measure persists to `outcome_measures` (which the
 * counsellor dashboard + reporting read back). Proves the write lands and that the
 * RLS child policy (via clients.org_id) rejects a client outside the caller's org.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
process.env.DATABASE_URL_APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

const { createOutcomeMeasureDb } = await import("@/db/queries/outcomes");

const ORG = "org_masizakhe";
const OTHER_ORG = "org_om_probe";
const CID = "cl_om_probe";
const OTHER_CID = "cl_om_other";

beforeAll(async () => {
  await sql`INSERT INTO clients (id, org_id, name, province, risk_flag, created_at) VALUES (${CID}, ${ORG}, 'OM Probe', 'Gauteng', false, now()) ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO orgs (id, name, slug, province, timezone, brand_accent) VALUES (${OTHER_ORG}, 'OM Other', 'om-other', 'Gauteng', 'Africa/Johannesburg', '#2f6f4f') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO clients (id, org_id, name, province, risk_flag, created_at) VALUES (${OTHER_CID}, ${OTHER_ORG}, 'OM Other Client', 'Gauteng', false, now()) ON CONFLICT (id) DO NOTHING`;
}, 30000);

afterAll(async () => {
  await sql`DELETE FROM outcome_measures WHERE client_id IN (${CID}, ${OTHER_CID})`;
  await sql`DELETE FROM clients WHERE id IN (${CID}, ${OTHER_CID})`;
  await sql`DELETE FROM orgs WHERE id = ${OTHER_ORG}`;
}, 30000);

describe("outcome measures (W1.2)", () => {
  it("persists a PHQ-9 score for a client in the caller's org", async () => {
    const { id } = await createOutcomeMeasureDb(ORG, { clientId: CID, tool: "PHQ-9", score: 12 }, new Date().toISOString());
    const [row] = await sql`SELECT tool, score FROM outcome_measures WHERE id = ${id}`;
    expect(row!.tool).toBe("PHQ-9");
    expect(row!.score).toBe(12);
  });

  it("RLS rejects scoring a client outside the caller's org", async () => {
    // Scoped to ORG, but the client belongs to OTHER_ORG → WITH CHECK denies the insert.
    await expect(createOutcomeMeasureDb(ORG, { clientId: OTHER_CID, tool: "GAD-7", score: 8 }, new Date().toISOString())).rejects.toThrow();
    const rows = await sql`SELECT count(*)::int n FROM outcome_measures WHERE client_id = ${OTHER_CID}`;
    expect(rows[0]!.n).toBe(0);
  });
});
