import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.1 — care-plan share + step add persist to `care_plans` (previously audit-only).
 * Proves share stamps `shared_at`, step-add appends a task, both create the plan if
 * absent, and the RLS child policy (via clients.org_id) rejects a cross-org client.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
process.env.DATABASE_URL_APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

const { shareCarePlanDb, addCarePlanStepDb } = await import("@/db/queries/care-plans");

const ORG = "org_masizakhe";
const OTHER_ORG = "org_cp_probe";
const CID = "cl_cp_probe";
const OTHER_CID = "cl_cp_other";
const COUNS = "couns_thabo";

beforeAll(async () => {
  await sql`INSERT INTO clients (id, org_id, name, province, risk_flag, created_at) VALUES (${CID}, ${ORG}, 'CP Probe', 'Gauteng', false, now()) ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO orgs (id, name, slug, province, timezone, brand_accent) VALUES (${OTHER_ORG}, 'CP Other', 'cp-other', 'Gauteng', 'Africa/Johannesburg', '#2f6f4f') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO clients (id, org_id, name, province, risk_flag, created_at) VALUES (${OTHER_CID}, ${OTHER_ORG}, 'CP Other Client', 'Gauteng', false, now()) ON CONFLICT (id) DO NOTHING`;
}, 30000);

afterAll(async () => {
  await sql`DELETE FROM care_plans WHERE client_id IN (${CID}, ${OTHER_CID})`;
  await sql`DELETE FROM clients WHERE id IN (${CID}, ${OTHER_CID})`;
  await sql`DELETE FROM orgs WHERE id = ${OTHER_ORG}`;
}, 30000);

describe("care plans (W1.1)", () => {
  it("share creates the plan + stamps shared_at; a step appends a task", async () => {
    await shareCarePlanDb(ORG, { clientId: CID, authorCounsellorId: COUNS, summary: "Between sessions, keep the sleep routine." }, new Date().toISOString());
    const { id: stepId } = await addCarePlanStepDb(ORG, { clientId: CID, authorCounsellorId: COUNS, text: "Try a 10-minute walk each morning." });

    const [plan] = await sql`SELECT summary, shared_at, tasks FROM care_plans WHERE client_id = ${CID}`;
    expect(plan!.summary).toContain("sleep routine");
    expect(plan!.shared_at).not.toBeNull();
    const tasks = plan!.tasks as { id: string; text: string; done: boolean }[];
    expect(tasks.some((t) => t.id === stepId && t.text.includes("10-minute walk"))).toBe(true);
  });

  it("RLS rejects a care-plan write for a client in another org", async () => {
    await expect(shareCarePlanDb(ORG, { clientId: OTHER_CID, authorCounsellorId: COUNS, summary: "leak" }, new Date().toISOString())).rejects.toThrow();
    const rows = await sql`SELECT count(*)::int n FROM care_plans WHERE client_id = ${OTHER_CID}`;
    expect(rows[0]!.n).toBe(0);
  });
});
