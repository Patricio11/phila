import { describe, it, expect, afterEach } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 11 — scheduling integrity. The DB exclusion constraints reject any
 * overlapping booking for the same counsellor or room (race-free, atomic).
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const A = "appt_sched_a";
const B = "appt_sched_b";

async function insert(id: string, counsellorId: string, roomId: string | null, startsAt: string, durationMin = 60, state = "scheduled") {
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
    VALUES (${id}, 'org_masizakhe', 'cl_megan', ${counsellorId}, 'svc_individual', 'in_person', ${roomId}, ${startsAt}, ${durationMin}, ${state}, '[]'::jsonb)`;
}

describe("appointment exclusion constraints", () => {
  afterEach(async () => {
    await sql`DELETE FROM appointments WHERE id IN (${A}, ${B})`;
  });

  it("rejects double-booking the same counsellor in an overlapping window", async () => {
    await insert(A, "couns_nomsa", null, "2026-09-01T10:00:00+02:00");
    await expect(insert(B, "couns_nomsa", null, "2026-09-01T10:30:00+02:00")).rejects.toThrow();
  });

  it("rejects double-booking the same room in an overlapping window", async () => {
    await insert(A, "couns_nomsa", "room_s1", "2026-09-01T14:00:00+02:00");
    // A different counsellor, same room, overlapping → room clash.
    await expect(insert(B, "couns_pieter", "room_s1", "2026-09-01T14:30:00+02:00")).rejects.toThrow();
  });

  it("allows back-to-back (non-overlapping) sessions", async () => {
    await insert(A, "couns_nomsa", "room_s1", "2026-09-01T16:00:00+02:00", 60);
    await expect(insert(B, "couns_nomsa", "room_s1", "2026-09-01T17:00:00+02:00", 60)).resolves.toBeUndefined();
  });

  it("a cancelled session frees the slot", async () => {
    await insert(A, "couns_nomsa", "room_s1", "2026-09-01T18:00:00+02:00", 60, "cancelled");
    await expect(insert(B, "couns_nomsa", "room_s1", "2026-09-01T18:00:00+02:00", 60)).resolves.toBeUndefined();
  });
});
