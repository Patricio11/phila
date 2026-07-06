import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.1 — supervision. A supervisee's signed note appears in their supervisor's
 * queue; signing it off removes it from the queue and stamps the supervisor fields.
 * Also proves a non-supervisor can't sign it (authorisation by supervisor link).
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
process.env.DATABASE_URL_APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

const { getSupervisionQueueDb, signOffNoteDb } = await import("@/db/queries/supervision");

const ORG = "org_masizakhe";
const SUPERVISOR = "couns_nomsa"; // supervises thabo/aisha/pieter
const SUPERVISEE = "couns_thabo";
const APPT = "appt_sup_probe";
const NOTE = "note_sup_probe";

beforeAll(async () => {
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state, tags)
    VALUES (${APPT}, ${ORG}, 'cl_lerato', ${SUPERVISEE}, 'svc_individual', 'online', '2027-08-01T09:00:00+02:00', 60, 'completed', '{}') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO session_notes (id, appointment_id, author_counsellor_id, body, ai_generated, signed_at)
    VALUES (${NOTE}, ${APPT}, ${SUPERVISEE}, 'Supervisee note pending review.', false, now()) ON CONFLICT (id) DO NOTHING`;
}, 30000);

afterAll(async () => {
  await sql`DELETE FROM session_notes WHERE id = ${NOTE}`;
  await sql`DELETE FROM appointments WHERE id = ${APPT}`;
}, 30000);

describe("supervision (W1.1)", () => {
  it("a signed supervisee note appears in the supervisor's queue", async () => {
    const q = await getSupervisionQueueDb(ORG, SUPERVISOR);
    const item = q.find((i) => i.id === NOTE);
    expect(item).toBeTruthy();
    expect(item!.superviseeId).toBe(SUPERVISEE);
  });

  it("a non-supervisor of the author can't sign it off", async () => {
    // couns_thabo has no supervisees, so signing NOTE isn't permitted.
    const res = await signOffNoteDb(ORG, { noteId: NOTE, supervisorCounsellorId: SUPERVISEE, decision: "approved" }, new Date().toISOString());
    expect(res.ok).toBe(false);
  });

  it("the supervisor signs it off → leaves the queue + stamps the fields", async () => {
    const res = await signOffNoteDb(ORG, { noteId: NOTE, supervisorCounsellorId: SUPERVISOR, decision: "approved", comment: "Good work." }, new Date().toISOString());
    expect(res.ok).toBe(true);

    const q = await getSupervisionQueueDb(ORG, SUPERVISOR);
    expect(q.find((i) => i.id === NOTE)).toBeUndefined();

    const [row] = await sql`SELECT supervisor_id, supervisor_signed_at, supervisor_decision FROM session_notes WHERE id = ${NOTE}`;
    expect(row!.supervisor_id).toBe(SUPERVISOR);
    expect(row!.supervisor_signed_at).not.toBeNull();
    expect(row!.supervisor_decision).toBe("approved");
  });
});
