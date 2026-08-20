import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Feedback #4 - counsellor offboarding is archive-only: migrate moves the
 * caseload + future sessions to the successor; cancel marks upcoming sessions
 * cancelled with a reason. NOTHING is deleted - history rows all survive.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { memberWorkloadDb, cancelUpcomingForCounsellorDb } = await import("@/db/queries/team");
const { transferCaseloadDb } = await import("@/db/queries/clients");

const ORG = "org_offboard_probe";

afterAll(async () => {
  await sql`DELETE FROM appointments WHERE org_id=${ORG}`;
  // Batch 4r - caseload transfer rehomes client folders, which creates folder rows.
  await sql`DELETE FROM document_shares WHERE org_id=${ORG}`;
  await sql`DELETE FROM documents WHERE org_id=${ORG}`;
  await sql`DELETE FROM document_folders WHERE org_id=${ORG}`;
  await sql`DELETE FROM clients WHERE org_id=${ORG}`;
  await sql`DELETE FROM services WHERE org_id=${ORG}`;
  await sql`DELETE FROM counsellors WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("counsellor offboarding", () => {
  it("workload counts, migrate moves everything, cancel marks (never deletes)", { timeout: 40_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, created_at)
      VALUES (${ORG}, 'Offboard Probe', 'offboard-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO counsellors (id, org_id, user_id, name, credential_body, credential_status) VALUES
      ('couns_off_a', ${ORG}, 'user_off_leaver', 'Leaving Counsellor', 'HPCSA', 'verified'),
      ('couns_off_b', ${ORG}, 'user_off_stayer', 'Staying Counsellor', 'HPCSA', 'verified')
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO services (id, org_id, name, duration_min, price_cents)
      VALUES ('svc_off', ${ORG}, 'Probe counselling', 60, 40000) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO clients (id, org_id, primary_counsellor_id, name, province, created_at) VALUES
      ('cl_off_1', ${ORG}, 'couns_off_a', 'Client One', 'Gauteng', now()),
      ('cl_off_2', ${ORG}, 'couns_off_a', 'Client Two', 'Gauteng', now())
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state) VALUES
      ('appt_off_past', ${ORG}, 'cl_off_1', 'couns_off_a', 'svc_off', 'in_person', now() - interval '10 days', 60, 'completed'),
      ('appt_off_f1',   ${ORG}, 'cl_off_1', 'couns_off_a', 'svc_off', 'in_person', now() + interval '3 days',  60, 'scheduled'),
      ('appt_off_f2',   ${ORG}, 'cl_off_2', 'couns_off_a', 'svc_off', 'in_person', now() + interval '5 days',  60, 'scheduled')
      ON CONFLICT (id) DO NOTHING`;

    // 1) Workload is honest.
    const w = await memberWorkloadDb(ORG, "user_off_leaver");
    expect(w.counsellorId).toBe("couns_off_a");
    expect(w.upcoming).toBe(2);
    expect(w.clients).toBe(2);

    // 2) Migrate: clients + future sessions move; the past session does NOT.
    const res = await transferCaseloadDb(ORG, "couns_off_a", "couns_off_b");
    expect(res.clients).toBe(2);
    expect(res.moved).toBe(2);
    const [past] = await sql`SELECT counsellor_id FROM appointments WHERE id='appt_off_past'`;
    expect(past!.counsellor_id).toBe("couns_off_a"); // history untouched
    const moved = await sql`SELECT count(*)::int AS n FROM appointments WHERE org_id=${ORG} AND counsellor_id='couns_off_b' AND state='scheduled'`;
    expect(moved[0]!.n).toBe(2);

    // 3) Cancel path (on the successor now): rows marked cancelled with reason - still present.
    const ids = await cancelUpcomingForCounsellorDb(ORG, "couns_off_b", "Counsellor left the practice");
    expect(ids.length).toBe(2);
    const after = await sql`SELECT state, cancel_reason FROM appointments WHERE id = ANY(${ids})`;
    for (const r of after) {
      expect(r.state).toBe("cancelled");
      expect(r.cancel_reason).toBe("Counsellor left the practice");
    }

    // 4) NOTHING deleted: all three appointment rows and both clients survive.
    const [counts] = await sql`SELECT (SELECT count(*)::int FROM appointments WHERE org_id=${ORG}) AS appts,
      (SELECT count(*)::int FROM clients WHERE org_id=${ORG}) AS clients`;
    expect(counts!.appts).toBe(3);
    expect(counts!.clients).toBe(2);
  });
});

describe("archive with cancel keeps the promise", () => {
  it("unassigns the leaver's clients instead of pointing them at an archive", { timeout: 40_000 }, async () => {
    const { unassignCaseloadDb } = await import("@/db/queries/clients");
    // Give the leaver a client, then free the caseload the way cancel-mode does.
    await sql`INSERT INTO clients (id, org_id, primary_counsellor_id, name, province, created_at)
      VALUES ('cl_ob_free', ${ORG}, 'couns_ob_leaver', 'Freed Client', 'Gauteng', now()) ON CONFLICT (id) DO NOTHING`;
    await sql`UPDATE clients SET primary_counsellor_id='couns_ob_leaver', deleted_at=NULL WHERE id='cl_ob_free'`;
    const freed = await unassignCaseloadDb(ORG, "couns_ob_leaver");
    expect(freed).toBeGreaterThanOrEqual(1);
    const [row] = await sql`SELECT primary_counsellor_id FROM clients WHERE id='cl_ob_free'`;
    expect(row!.primary_counsellor_id).toBeNull();
    await sql`DELETE FROM clients WHERE id='cl_ob_free'`;
  });
});
