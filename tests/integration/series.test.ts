import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 11  recurring series edit-this/all, exercising the REAL query functions
 * (db/queries/appointments). createAppointment links a weekly series; reschedule/
 * cancel with scope "following" act on this + every later session.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL = DATABASE_URL; // so getDb() inside the query fns connects
const sql = neon(DATABASE_URL);

// Imported after the env is set; the module only connects when a fn runs.
import { createAppointment, rescheduleAppointment, cancelAppointment } from "@/db/queries/appointments";

const FAR = "2027-03-01"; // a Monday, no seeded appointments nearby

afterAll(async () => {
  await sql`DELETE FROM appointments WHERE counsellor_id = 'couns_nomsa' AND starts_at >= '2027-03-01T00:00:00+02:00'`;
});

describe("recurring series (edit-this/all)", () => {
  it("createAppointment links a weekly series by seriesId", async () => {
    await createAppointment({
      orgId: "org_masizakhe", clientId: "cl_megan", serviceId: "svc_individual", counsellorId: "couns_nomsa",
      type: "online", roomId: null, date: FAR, time: "09:00", durationMin: 60, recurring: true, recurringCount: 3,
    });
    const rows = await sql`SELECT id, series_id, starts_at FROM appointments WHERE counsellor_id='couns_nomsa' AND starts_at >= '2027-03-01T00:00:00+02:00' ORDER BY starts_at`;
    expect(rows.length).toBe(3);
    expect(rows[0]!.series_id).toBeTruthy();
    expect(new Set(rows.map((r) => r.series_id)).size).toBe(1); // all share one series
  });

  it("reschedule scope=following shifts this + all later sessions by the same delta", async () => {
    const rows = await sql`SELECT id, starts_at FROM appointments WHERE counsellor_id='couns_nomsa' AND starts_at >= '2027-03-01T00:00:00+02:00' ORDER BY starts_at`;
    const firstId = rows[0]!.id as string;
    const moved = await rescheduleAppointment(firstId, "2027-03-01T10:00:00+02:00", "following");
    expect(moved).toBe(3);
    const after = await sql`SELECT starts_at FROM appointments WHERE counsellor_id='couns_nomsa' AND starts_at >= '2027-03-01T00:00:00+02:00' ORDER BY starts_at`;
    // every session is now at 10:00 SAST (08:00 UTC), one week apart
    for (const r of after) expect(new Date(r.starts_at as string).toISOString().slice(11, 16)).toBe("08:00");
  });

  it("cancel scope=following cancels this + all later sessions", async () => {
    const rows = await sql`SELECT id FROM appointments WHERE counsellor_id='couns_nomsa' AND starts_at >= '2027-03-01T00:00:00+02:00' AND state <> 'cancelled' ORDER BY starts_at`;
    const cancelled = await cancelAppointment(rows[0]!.id as string, "Counsellor on leave", "following");
    expect(cancelled).toBe(3);
    const remaining = await sql`SELECT count(*)::int n FROM appointments WHERE counsellor_id='couns_nomsa' AND starts_at >= '2027-03-01T00:00:00+02:00' AND state <> 'cancelled'`;
    expect(remaining[0]!.n).toBe(0);
  });
});
