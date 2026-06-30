import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 15A/15B — invoice payments + subscriptions settle idempotently, and an
 * org gateway round-trips through encryption. No Paystack calls; we drive the
 * settle/persistence layer directly.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const fieldKey = env.match(/^PHILA_FIELD_KEY=(.+)$/m)?.[1]?.trim();
if (fieldKey) process.env.PHILA_FIELD_KEY = fieldKey;
const sql = neon(process.env.DATABASE_URL!);

import { recordInvoicePayment, settleInvoicePayment, getPayableInvoice } from "@/db/queries/invoice-payments";
import { settleSubscription, getSubscriptionRow } from "@/db/queries/subscriptions";
import { saveOrgGateway, getOrgGatewaySecret, getOrgGatewayStatus } from "@/db/queries/org-gateway";

const ORG = "org_masizakhe";
const INVOICE = "inv1";
const IREF = "ref_test_inv15";
const SREF = "ref_test_sub15";

afterAll(async () => {
  await sql`DELETE FROM payments WHERE provider_ref IN (${IREF}, ${SREF})`;
  await sql`UPDATE invoices SET status = 'unpaid' WHERE id = ${INVOICE}`;
  await sql`UPDATE subscriptions SET plan_id = 'p_community', status = 'active' WHERE org_id = ${ORG}`;
  await sql`DELETE FROM org_payment_connections WHERE org_id = ${ORG}`;
});

describe("15B — client invoice payment", () => {
  it("marks the invoice paid once; replays no-op", async () => {
    await sql`DELETE FROM payments WHERE provider_ref = ${IREF}`;
    await sql`UPDATE invoices SET status = 'unpaid' WHERE id = ${INVOICE}`;

    await recordInvoicePayment(ORG, INVOICE, "paystack", IREF, 45000);
    const first = await settleInvoicePayment(IREF);
    expect(first.paid).toBe(true);
    expect((await getPayableInvoice(INVOICE))?.status).toBe("paid");

    const second = await settleInvoicePayment(IREF);
    expect(second.paid).toBe(false);
  });
});

describe("15A — plan subscription", () => {
  it("activates the paid plan once; replays no-op", async () => {
    await sql`DELETE FROM payments WHERE provider_ref = ${SREF}`;
    await sql`INSERT INTO payments (org_id, provider, provider_ref, purpose, pack_id, amount_cents, status, created_at)
      VALUES (${ORG}, 'paystack', ${SREF}, 'subscription', 'p_practice', 120000, 'pending', now())`;

    const first = await settleSubscription(SREF);
    expect(first.active).toBe(true);
    expect((await getSubscriptionRow(ORG))?.planId).toBe("p_practice");
    expect((await getSubscriptionRow(ORG))?.status).toBe("active");

    const second = await settleSubscription(SREF);
    expect(second.active).toBe(false);
  });
});

describe("15B — org gateway credentials", () => {
  it("round-trips the secret through encryption and gates on enabled", async () => {
    await saveOrgGateway(ORG, "paystack", { secretKey: "sk_test_roundtrip" }, true);
    const status = await getOrgGatewayStatus(ORG);
    expect(status).toMatchObject({ provider: "paystack", enabled: true, configured: true });
    expect((await getOrgGatewaySecret(ORG))?.secretKey).toBe("sk_test_roundtrip");

    // Switched off → no live secret even though it's stored.
    await saveOrgGateway(ORG, "paystack", { secretKey: "sk_test_roundtrip" }, false);
    expect(await getOrgGatewaySecret(ORG)).toBeNull();
  });
});
