import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 31.1 — DSAR export + erasure against the real DB. The export assembles
 * everything held on the probe client; erasure de-identifies + soft-deletes and
 * returns the honest retention decision; a legal hold blocks it outright.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { exportDataSubjectDb, eraseDataSubjectDb, setLegalHoldDb, clientRetentionDb } = await import("@/db/queries/dsar");

const ORG = "org_dsar_probe";
const CL = "cl_dsar_probe";
const NOW = new Date().toISOString();

afterAll(async () => {
  await sql`DELETE FROM appointments WHERE org_id=${ORG}`;
  await sql`DELETE FROM demographics WHERE client_id=${CL}`;
  await sql`DELETE FROM clients WHERE org_id=${ORG}`;
  await sql`DELETE FROM services WHERE org_id=${ORG}`;
  await sql`DELETE FROM counsellors WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("DSAR export + erasure", () => {
  it("exports everything, honours retention on erasure, and respects a legal hold", { timeout: 30_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, created_at)
      VALUES (${ORG}, 'DSAR Probe Org', 'dsar-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO counsellors (id, org_id, user_id, name, credential_body, credential_status)
      VALUES ('couns_dsar', ${ORG}, 'user_dsar_probe', 'Probe Counsellor', 'HPCSA', 'verified') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO services (id, org_id, name, duration_min, price_cents)
      VALUES ('svc_dsar', ${ORG}, 'Probe counselling', 60, 45000) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO clients (id, org_id, primary_counsellor_id, name, phone, email, province, profile, created_at)
      VALUES (${CL}, ${ORG}, 'couns_dsar', 'Probe Person', '+27820000001', 'probe@example.co.za', 'Gauteng',
        '{"dateOfBirth":"1990-04-01"}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state)
      VALUES ('appt_dsar_1', ${ORG}, ${CL}, 'couns_dsar', 'svc_dsar', 'in_person', now() - interval '30 days', 60, 'completed')
      ON CONFLICT (id) DO NOTHING`;

    // Export: assembles identity + history + the retention clock.
    const exp = await exportDataSubjectDb(ORG, CL, NOW);
    expect(exp).not.toBeNull();
    expect(exp!.client.name).toBe("Probe Person");
    expect(exp!.appointments.length).toBe(1);
    expect(exp!.retention.rule).toBe("standard");
    expect(exp!.retention.retainUntil).not.toBeNull();
    expect(exp!.retention.label).toMatch(/Retained until/);

    // Legal hold blocks erasure outright.
    await setLegalHoldDb(ORG, CL, true, "probe hold");
    const blocked = await eraseDataSubjectDb(ORG, CL, NOW);
    expect(blocked!.ok).toBe(false);
    expect(blocked!.decision.reason).toMatch(/legal hold/i);
    await setLegalHoldDb(ORG, CL, false, null);

    // Erasure inside the clock: de-identifies NOW, honest mandated-retention reason.
    const res = await eraseDataSubjectDb(ORG, CL, NOW);
    expect(res!.ok).toBe(true);
    expect(res!.decision.allowed).toBe(false);
    expect(res!.decision.reason).toMatch(/HPCSA/);
    const [row] = await sql`SELECT name, email, phone, profile, deleted_at FROM clients WHERE id=${CL}`;
    expect(String(row!.name)).toMatch(/^Removed client/);
    expect(row!.email).toBeNull();
    expect(row!.phone).toBeNull();
    expect(row!.deleted_at).not.toBeNull();

    // Retention clock still computable post-erasure (record held under its clock).
    const ret = await clientRetentionDb(ORG, CL, NOW);
    expect(ret!.clock.rule).toBe("standard");
  });
});
