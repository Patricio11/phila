import { describe, it, expect, afterEach } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 12.4 — appointment events fire notifications. notifyAppointment looks up
 * the recipient + vars and routes through deliver, recording an honest message_log
 * entry (dormant in tests, since the transports have no creds).
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL = DATABASE_URL;
const sql = neon(DATABASE_URL);

import { notifyAppointment } from "@/lib/messaging/notify";

const ORG = "org_masizakhe";
const CID = "cl_trig_probe";
const AID = "appt_trig_probe";

afterEach(async () => {
  await sql`DELETE FROM message_log WHERE org_id=${ORG} AND to_masked='+27***99'`;
  await sql`DELETE FROM appointments WHERE id=${AID}`;
  await sql`DELETE FROM clients WHERE id=${CID}`;
});

describe("notifyAppointment", () => {
  it("records an honest message_log entry for a booking event", async () => {
    await sql`INSERT INTO clients (id, org_id, name, phone, email, province, primary_counsellor_id, risk_flag, created_at)
      VALUES (${CID}, ${ORG}, 'Trigger Probe', '+27820009999', 'probe@example.co.za', 'Gauteng', 'couns_nomsa', false, now())`;
    // couns_pieter (not nomsa) + a date well clear of the series test's 2027-03 range, so the
    // parallel integration tests don't collide on the shared DB.
    await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
      VALUES (${AID}, ${ORG}, ${CID}, 'couns_pieter', 'svc_individual', 'online', null, '2027-09-01T10:00:00+02:00', 60, 'scheduled', '[]'::jsonb)`;

    await notifyAppointment(AID, "booked");

    const [log] = await sql`SELECT channel, trigger, status FROM message_log WHERE org_id=${ORG} AND to_masked='+27***99' ORDER BY created_at DESC LIMIT 1`;
    expect(log).toBeTruthy();
    expect(log!.trigger).toBe("booked");
    // masizakhe has SMS+Email on (WhatsApp off); no stated preference → fallback to SMS.
    expect(log!.channel).toBe("sms");
    expect(log!.status).toBe("dormant"); // honest — no provider creds in test env
  });
});
