import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 15.1  credit purchase settles idempotently. A paid pack tops up the
 * balance once (the ledger is keyed on the payment ref); a replayed webhook is a
 * no-op. No Paystack call  we settle the payment record directly.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

import { createPayment, settlePayment, listPayments } from "@/db/queries/payments";
import { getCreditBalances } from "@/db/queries/messaging";
import { packById } from "@/lib/payments/packs";

const ORG = "org_masizakhe";
const REF = "ref_test_p15";

afterAll(async () => {
  await sql`DELETE FROM credit_ledger WHERE idempotency_key = ${`purchase_${REF}`}`;
  await sql`DELETE FROM payments WHERE provider_ref = ${REF}`;
  await sql`UPDATE credit_balances SET balance = 100 WHERE org_id = ${ORG} AND channel = 'email'`;
});

describe("credit purchase", () => {
  // Uses the EMAIL balance so it never races the SMS-based deliver suite.
  it("settles once and is idempotent on the payment ref", async () => {
    await sql`DELETE FROM credit_ledger WHERE idempotency_key = ${`purchase_${REF}`}`;
    await sql`DELETE FROM payments WHERE provider_ref = ${REF}`;
    await sql`UPDATE credit_balances SET balance = 100 WHERE org_id = ${ORG} AND channel = 'email'`;

    const pack = packById("email_1000")!;
    await createPayment(ORG, pack, "paystack", REF);

    const before = (await getCreditBalances(ORG)).email;
    const first = await settlePayment(REF);
    expect(first.credited).toBe(1000);
    expect(first.channel).toBe("email");
    expect((await getCreditBalances(ORG)).email).toBe(before + 1000);

    // Replay (e.g. webhook + callback both fire)  no double top-up.
    const second = await settlePayment(REF);
    expect(second.credited).toBe(0);
    expect((await getCreditBalances(ORG)).email).toBe(before + 1000);

    const row = (await listPayments(ORG, 20)).find((r) => r.providerRef === REF);
    expect(row).toMatchObject({ providerRef: REF, status: "paid", channel: "email", creditsAmount: 1000 });
  });
});
