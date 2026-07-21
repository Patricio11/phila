import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 31.2 — the pruner never destroys inside the clock or under hold, and in
 * destroy mode wipes only the lapsed, unheld record's clinical children. The
 * route handler is exercised directly (report mode first, then destroy).
 */
const envFile = readFileSync(".env.local", "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !line.trim().startsWith("#")) process.env[m[1]!] = m[2]!.trim();
}
delete process.env.CRON_SECRET; // dev-open path for the probe
delete process.env.RETENTION_PRUNER_MODE;
const sql = neon(process.env.DATABASE_URL!);

const { GET } = await import("@/app/api/cron/retention/route");

const ORG = "org_prune_probe";
const LAPSED = "cl_prune_lapsed";
const HELD = "cl_prune_held";
const FRESH = "cl_prune_fresh";

afterAll(async () => {
  delete process.env.RETENTION_PRUNER_MODE;
  await sql`DELETE FROM outcome_measures WHERE client_id IN (${LAPSED}, ${HELD}, ${FRESH})`;
  await sql`DELETE FROM appointments WHERE org_id=${ORG}`;
  await sql`DELETE FROM clients WHERE org_id=${ORG}`;
  await sql`DELETE FROM services WHERE org_id=${ORG}`;
  await sql`DELETE FROM counsellors WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("retention pruner", () => {
  it("reports lapsed-only, holds back legal holds, and destroys only when enabled", { timeout: 40_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, created_at)
      VALUES (${ORG}, 'Prune Probe', 'prune-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO counsellors (id, org_id, user_id, name, credential_body, credential_status)
      VALUES ('couns_prune', ${ORG}, 'user_prune_probe', 'Prune Counsellor', 'HPCSA', 'verified') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO services (id, org_id, name, duration_min, price_cents)
      VALUES ('svc_prune', ${ORG}, 'Prune service', 60, 0) ON CONFLICT (id) DO NOTHING`;
    // Lapsed (last entry 2015), held (lapsed but legal_hold), fresh (recent).
    await sql`INSERT INTO clients (id, org_id, primary_counsellor_id, name, phone, province, profile, legal_hold, created_at) VALUES
      (${LAPSED}, ${ORG}, 'couns_prune', 'Lapsed Person', '+27820000010', 'Gauteng', '{}'::jsonb, false, '2015-01-01T00:00:00Z'),
      (${HELD},   ${ORG}, 'couns_prune', 'Held Person',   '+27820000011', 'Gauteng', '{}'::jsonb, true,  '2015-01-01T00:00:00Z'),
      (${FRESH},  ${ORG}, 'couns_prune', 'Fresh Person',  '+27820000012', 'Gauteng', '{}'::jsonb, false, now())
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state) VALUES
      ('appt_prune_l', ${ORG}, ${LAPSED}, 'couns_prune', 'svc_prune', 'in_person', '2015-06-01T10:00:00Z', 60, 'completed'),
      ('appt_prune_h', ${ORG}, ${HELD},   'couns_prune', 'svc_prune', 'in_person', '2015-06-01T12:00:00Z', 60, 'completed')
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO outcome_measures (id, client_id, tool, score, taken_at) VALUES
      ('om_prune_l', ${LAPSED}, 'PHQ9', 12, '2015-06-01T10:00:00Z') ON CONFLICT (id) DO NOTHING`;

    // 1) Report-only (default): lists the lapsed candidate, touches nothing.
    const report = await (await GET(new Request("http://local/api/cron/retention"))).json();
    expect(report.mode).toBe("report-only");
    const ids = (report.candidates as { clientId: string }[]).map((c) => c.clientId);
    expect(ids).toContain(LAPSED);
    expect(ids).not.toContain(HELD); // heldBack, never a candidate
    expect(ids).not.toContain(FRESH);
    expect(report.heldBack).toBeGreaterThanOrEqual(1);
    const [untouched] = await sql`SELECT name FROM clients WHERE id=${LAPSED}`;
    expect(untouched!.name).toBe("Lapsed Person");

    // 2) Destroy mode (explicit enable): wipes ONLY the lapsed, unheld record.
    process.env.RETENTION_PRUNER_MODE = "destroy";
    const run = await (await GET(new Request("http://local/api/cron/retention"))).json();
    expect(run.mode).toBe("destroy");
    expect(run.destroyed).toBeGreaterThanOrEqual(1);

    const [gone] = await sql`SELECT name, phone, deleted_at FROM clients WHERE id=${LAPSED}`;
    expect(String(gone!.name)).toMatch(/^Removed client/);
    expect(gone!.phone).toBeNull();
    expect(gone!.deleted_at).not.toBeNull();
    const oms = await sql`SELECT id FROM outcome_measures WHERE client_id=${LAPSED}`;
    expect(oms.length).toBe(0);

    const [heldRow] = await sql`SELECT name FROM clients WHERE id=${HELD}`;
    expect(heldRow!.name).toBe("Held Person"); // hold survives destroy mode
    const [freshRow] = await sql`SELECT name FROM clients WHERE id=${FRESH}`;
    expect(freshRow!.name).toBe("Fresh Person");
  });
});
