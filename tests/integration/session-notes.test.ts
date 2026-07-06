import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.1 — clinical session notes persist to `session_notes` (previously the sign
 * action was audit-only). Proves draft save → sign upsert (one note per session),
 * read-back, and that the RLS child policy (via appointments.org_id) rejects a
 * note whose appointment is in another org.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
process.env.DATABASE_URL_APP = env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

const { saveSessionNoteDb, getSessionNoteDb } = await import("@/db/queries/session-notes");
const { runForOrg } = await import("@/lib/db/scoped");

const ORG = "org_masizakhe";
const OTHER_ORG = "org_note_probe";
const APPT = "appt_note_probe";
const OTHER_APPT = "appt_note_other";
const COUNS = "couns_thabo"; // not couns_nomsa — avoids colliding with series.test's queries

beforeAll(async () => {
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state, tags)
    VALUES (${APPT}, ${ORG}, 'cl_lerato', ${COUNS}, 'svc_individual', 'online', '2027-05-01T09:00:00+02:00', 60, 'completed', '{}') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO orgs (id, name, slug, province, timezone, brand_accent) VALUES (${OTHER_ORG}, 'Note Other', 'note-other', 'Gauteng', 'Africa/Johannesburg', '#2f6f4f') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state, tags)
    VALUES (${OTHER_APPT}, ${OTHER_ORG}, 'cl_lerato', ${COUNS}, 'svc_individual', 'online', '2027-05-01T14:00:00+02:00', 60, 'completed', '{}') ON CONFLICT (id) DO NOTHING`;
}, 30000);

afterAll(async () => {
  await sql`DELETE FROM session_notes WHERE appointment_id IN (${APPT}, ${OTHER_APPT})`;
  await sql`DELETE FROM appointments WHERE id IN (${APPT}, ${OTHER_APPT})`;
  await sql`DELETE FROM orgs WHERE id = ${OTHER_ORG}`;
}, 30000);

describe("session notes (W1.1)", () => {
  it("draft-saves, then sign upserts the same note (one per session) + stamps signedAt", async () => {
    await saveSessionNoteDb(ORG, { appointmentId: APPT, authorCounsellorId: COUNS, body: "draft one" }, new Date().toISOString());
    const draft = await runForOrg(ORG, () => getSessionNoteDb(APPT));
    expect(draft?.body).toBe("draft one");
    expect(draft?.signedAt).toBeNull();

    const res = await saveSessionNoteDb(ORG, { appointmentId: APPT, authorCounsellorId: COUNS, body: "final note", sign: true }, new Date().toISOString());
    expect(res.signedAt).not.toBeNull();

    const rows = await sql`SELECT body, signed_at FROM session_notes WHERE appointment_id = ${APPT}`;
    expect(rows.length).toBe(1); // still one note, updated in place
    expect(rows[0]!.body).toBe("final note");
    expect(rows[0]!.signed_at).not.toBeNull();
  });

  it("RLS rejects writing a note for an appointment in another org", async () => {
    await expect(saveSessionNoteDb(ORG, { appointmentId: OTHER_APPT, authorCounsellorId: COUNS, body: "leak" }, new Date().toISOString())).rejects.toThrow();
    const rows = await sql`SELECT count(*)::int n FROM session_notes WHERE appointment_id = ${OTHER_APPT}`;
    expect(rows[0]!.n).toBe(0);
  });
});
