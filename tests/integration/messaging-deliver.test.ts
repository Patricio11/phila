import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 12.3  the deliver chokepoint, exercised against the DB. The SMS/email
 * transports are dormant in tests (no provider creds), so we verify the gating +
 * metering + honest message_log states  never a fake "sent", never a wrong charge.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL = DATABASE_URL;
const sql = neon(DATABASE_URL);

import { deliver } from "@/lib/messaging/deliver";

const ORG = "org_masizakhe";
const vars = { clientName: "Lerato", practiceName: "Masizakhe", serviceName: "Individual counselling", counsellorName: "Nomsa", date: "Mon 6 Jul", time: "10:00" };
const recipient = { phone: "+27820000123", email: "lerato@example.co.za", preferredContact: "Phone call" }; // → SMS

beforeEach(async () => {
  await sql`DELETE FROM message_log WHERE org_id=${ORG} AND to_masked='+27***23'`;
  await sql`DELETE FROM credit_ledger WHERE org_id=${ORG} AND reason='send'`;
  await sql`UPDATE credit_balances SET balance=100 WHERE org_id=${ORG} AND channel='sms'`;
  await sql`DELETE FROM message_opt_outs WHERE org_id=${ORG}`;
});
afterAll(async () => {
  await sql`DELETE FROM message_log WHERE org_id=${ORG} AND to_masked='+27***23'`;
  await sql`DELETE FROM credit_ledger WHERE org_id=${ORG} AND reason='send'`;
  await sql`DELETE FROM message_opt_outs WHERE org_id=${ORG}`;
  await sql`UPDATE credit_balances SET balance=100 WHERE org_id=${ORG} AND channel='sms'`;
});

describe("deliver pipeline", () => {
  it("routes by preference, stays honest when the transport is dormant, and doesn't charge", async () => {
    const out = await deliver({ orgId: ORG, trigger: "booked", ref: "appt_t1", recipient, vars });
    expect(out.channel).toBe("sms"); // "Phone call" → SMS
    expect(out.status).toBe("dormant"); // no BulkSMS creds in test env  honest, not "sent"

    const [log] = await sql`SELECT status, cost_credits, to_masked FROM message_log WHERE org_id=${ORG} AND to_masked='+27***23' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.status).toBe("dormant");
    expect(log!.cost_credits).toBe(0); // dormant never charges
    expect(String(log!.to_masked)).not.toContain("0000123"); // contact is masked

    // Dormant created no debit (robust vs. concurrent credit top-ups in other suites).
    const [debits] = await sql`SELECT count(*)::int n FROM credit_ledger WHERE org_id=${ORG} AND reason='send'`;
    expect(debits!.n).toBe(0);
  });

  it("blocks with no_credit when the balance is exhausted", async () => {
    await sql`UPDATE credit_balances SET balance=0 WHERE org_id=${ORG} AND channel='sms'`;
    const out = await deliver({ orgId: ORG, trigger: "booked", ref: "appt_t2", recipient, vars });
    expect(out.status).toBe("no_credit");
    const [log] = await sql`SELECT status FROM message_log WHERE org_id=${ORG} AND to_masked='+27***23' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.status).toBe("no_credit");
  });

  it("respects an opt-out (POPIA  always wins)", async () => {
    await sql`INSERT INTO message_opt_outs (org_id, channel, target, created_at) VALUES (${ORG}, 'sms', ${recipient.phone}, now())`;
    const out = await deliver({ orgId: ORG, trigger: "booked", ref: "appt_t3", recipient, vars });
    expect(out.status).toBe("opted_out");
  });

  it("returns no_channel when the org has the preferred + all channels off", async () => {
    await sql`UPDATE org_messaging_settings SET sms_enabled=false, email_enabled=false, whatsapp_enabled=false WHERE org_id=${ORG}`;
    try {
      const out = await deliver({ orgId: ORG, trigger: "booked", ref: "appt_t4", recipient, vars });
      expect(out.status).toBe("no_channel");
    } finally {
      await sql`UPDATE org_messaging_settings SET sms_enabled=true, email_enabled=true WHERE org_id=${ORG}`;
    }
  });
});
