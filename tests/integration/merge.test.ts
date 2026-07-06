import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.6  mergeClients re-points a duplicate's whole history onto the kept record
 * and soft-deletes the loser. Nothing is lost or double-counted (Outcome-Honesty).
 */
const envFile = readFileSync(".env.local", "utf8");
const DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL = DATABASE_URL;
// The merge runs via runForOrg (phila_app); give it its connection.
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

import { mergeClientsDb } from "@/db/queries/merge";

const ORG = "org_masizakhe";
const KEEP = "cl_merge_keep";
const LOSE = "cl_merge_lose";
const APPT = "appt_merge_probe";
const INV = "inv_merge_probe";

afterAll(async () => {
  await sql`DELETE FROM appointments WHERE id=${APPT}`;
  await sql`DELETE FROM invoices WHERE id=${INV}`;
  await sql`DELETE FROM consents WHERE client_id IN (${KEEP}, ${LOSE})`;
  await sql`DELETE FROM clients WHERE id IN (${KEEP}, ${LOSE})`;
});

describe("mergeClientsDb", () => {
  it("re-points sessions, invoices, and consents; backfills contact; soft-deletes the loser", { timeout: 30_000 }, async () => {
    // Keeper has no phone; loser carries one (the merge should consolidate it).
    await sql`INSERT INTO clients (id, org_id, name, phone, province, primary_counsellor_id, risk_flag, created_at)
      VALUES (${KEEP}, ${ORG}, 'Merge Keeper', NULL, 'Gauteng', 'couns_thabo', false, now())`;
    await sql`INSERT INTO clients (id, org_id, name, phone, province, primary_counsellor_id, risk_flag, created_at)
      VALUES (${LOSE}, ${ORG}, 'Merge Loser', '+27820007777', 'Gauteng', 'couns_thabo', false, now())`;
    // Loser owns a session + an invoice + a consent the keeper lacks.
    await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
      VALUES (${APPT}, ${ORG}, ${LOSE}, 'couns_thabo', 'svc_individual', 'online', null, '2027-11-02T10:00:00+02:00', 60, 'scheduled', '[]'::jsonb)`;
    await sql`INSERT INTO invoices (id, client_id, org_id, number, service_name, amount_cents, status, issued_at, due_at)
      VALUES (${INV}, ${LOSE}, ${ORG}, 'MZ-MERGE-1', 'Individual counselling', 45000, 'sent', now(), now())`;
    await sql`INSERT INTO consents (org_id, client_id, purpose, state, version, updated_at)
      VALUES (${ORG}, ${LOSE}, 'demographics', 'granted', 1, now())`;

    const res = await mergeClientsDb(ORG, KEEP, [LOSE]);
    expect(res.ok).toBe(true);
    expect(res.merged).toBe(1);

    // Session + invoice now belong to the keeper.
    const [appt] = await sql`SELECT client_id FROM appointments WHERE id=${APPT}`;
    expect(appt!.client_id).toBe(KEEP);
    const [inv] = await sql`SELECT client_id FROM invoices WHERE id=${INV}`;
    expect(inv!.client_id).toBe(KEEP);
    // Consent gap filled onto the keeper.
    const [con] = await sql`SELECT client_id FROM consents WHERE org_id=${ORG} AND purpose='demographics' AND client_id=${KEEP}`;
    expect(con?.client_id).toBe(KEEP);
    // Keeper's missing phone was backfilled from the loser.
    const [keeper] = await sql`SELECT phone, deleted_at FROM clients WHERE id=${KEEP}`;
    expect(keeper!.phone).toBe("+27820007777");
    expect(keeper!.deleted_at).toBeNull();
    // Loser is soft-deleted (retained, restorable), not destroyed.
    const [loser] = await sql`SELECT deleted_at FROM clients WHERE id=${LOSE}`;
    expect(loser!.deleted_at).not.toBeNull();
  });

  it("refuses to merge a record into itself / a non-existent keeper", async () => {
    const res = await mergeClientsDb(ORG, "cl_does_not_exist", [LOSE]);
    expect(res.ok).toBe(false);
    expect(res.merged).toBe(0);
  });
});
