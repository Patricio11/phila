import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 18.8 — caseload transfer + reschedule note.
 * Proves the transfer moves the clients + FUTURE sessions, skips diary clashes,
 * and leaves the past (history) completely intact; and that a reschedule can
 * carry an optional reason kept on the record.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const app = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim();
if (app) process.env.DATABASE_URL_APP = app;
const sql = neon(process.env.DATABASE_URL!);

import { transferCaseloadDb, reassignClientDb } from "@/db/queries/clients";
import { rescheduleAppointment } from "@/db/queries/appointments";

const ORG = "org_masizakhe";
const FROM = "couns_txf_from";
const TO = "couns_txf_to";
const CL = "cl_txf_1";
const CL2 = "cl_txf_2";
const APPT = { past: "appt_txf_past", future1: "appt_txf_f1", future2: "appt_txf_f2", blocker: "appt_txf_blk" };

const at = (daysFromNow: number, hour: number, min = 0) => {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  d.setUTCHours(hour, min, 0, 0);
  return d.toISOString();
};

async function cleanup() {
  await sql`DELETE FROM appointments WHERE id IN (${APPT.past}, ${APPT.future1}, ${APPT.future2}, ${APPT.blocker})`;
  await sql`DELETE FROM notifications WHERE user_id IN ('user_txf_to')`;
  await sql`DELETE FROM clients WHERE id IN (${CL}, ${CL2})`;
  await sql`DELETE FROM counsellors WHERE id IN (${FROM}, ${TO})`;
}

beforeAll(async () => {
  await cleanup();
  const svc = await sql`SELECT id FROM services WHERE org_id = ${ORG} LIMIT 1`;
  const svcId = svc[0]!.id as string;
  await sql`INSERT INTO counsellors (id, user_id, org_id, name, credential_body, credential_status, is_supervisor)
    VALUES (${FROM}, 'user_txf_from', ${ORG}, 'Txf From', 'HPCSA', 'verified', false),
           (${TO}, 'user_txf_to', ${ORG}, 'Txf To', 'HPCSA', 'verified', false)`;
  await sql`INSERT INTO clients (id, org_id, name, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${CL}, ${ORG}, 'Txf Client', 'Gauteng', ${FROM}, false, now() - interval '90 days'),
           (${CL2}, ${ORG}, 'Txf Other', 'Gauteng', ${TO}, false, now() - interval '90 days')`;
  // History: a completed session last week (must NEVER move).
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state)
    VALUES (${APPT.past}, ${ORG}, ${CL}, ${FROM}, ${svcId}, 'online', null, now() - interval '7 days', 60, 'completed')`;
  // Future: one clean, one that clashes with the receiver's diary.
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state)
    VALUES (${APPT.future1}, ${ORG}, ${CL}, ${FROM}, ${svcId}, 'online', null, ${at(7, 8)}, 60, 'scheduled'),
           (${APPT.future2}, ${ORG}, ${CL}, ${FROM}, ${svcId}, 'online', null, ${at(8, 8)}, 60, 'scheduled'),
           (${APPT.blocker}, ${ORG}, ${CL2}, ${TO}, ${svcId}, 'online', null, ${at(8, 8, 30)}, 60, 'scheduled')`;
});

afterAll(cleanup);

describe("caseload transfer", () => {
  it("moves clients + future sessions, skips clashes, and history stays intact", { timeout: 30_000 }, async () => {
    const res = await transferCaseloadDb(ORG, FROM, TO);
    expect(res.clients).toBe(1);
    expect(res.moved).toBe(1); // future1
    expect(res.skipped).toBe(1); // future2 clashes with the blocker

    const [client] = await sql`SELECT primary_counsellor_id FROM clients WHERE id = ${CL}`;
    expect(client!.primary_counsellor_id).toBe(TO);

    // History untouched — the past session stays with the original counsellor.
    const [past] = await sql`SELECT counsellor_id, state FROM appointments WHERE id = ${APPT.past}`;
    expect(past!.counsellor_id).toBe(FROM);
    expect(past!.state).toBe("completed");

    const [f1] = await sql`SELECT counsellor_id FROM appointments WHERE id = ${APPT.future1}`;
    expect(f1!.counsellor_id).toBe(TO);
    const [f2] = await sql`SELECT counsellor_id FROM appointments WHERE id = ${APPT.future2}`;
    expect(f2!.counsellor_id).toBe(FROM); // skipped, still with the old counsellor
  });

  it("single-client reassign also brings future sessions", { timeout: 30_000 }, async () => {
    // Move the skipped session's clash out of the way, then reassign back to FROM.
    await sql`DELETE FROM appointments WHERE id = ${APPT.blocker}`;
    const res = await reassignClientDb(ORG, CL, FROM);
    expect(res.moved).toBe(1); // future1 comes back to FROM (future2 already there)
    const [client] = await sql`SELECT primary_counsellor_id FROM clients WHERE id = ${CL}`;
    expect(client!.primary_counsellor_id).toBe(FROM);
  });
});

describe("reschedule with a reason", () => {
  it("stores the optional note on the moved session", { timeout: 30_000 }, async () => {
    const moved = await rescheduleAppointment(ORG, APPT.future1, at(9, 8), "this", "Client asked to move — exam week");
    expect(moved).toBe(1);
    const [row] = await sql`SELECT reschedule_note, starts_at FROM appointments WHERE id = ${APPT.future1}`;
    expect(row!.reschedule_note).toBe("Client asked to move — exam week");
  });
});
