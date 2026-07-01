import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 18.5  direct-message integrity across TWO browsers. A brand-new DM between
 * a counsellor and the hub must (a) end up as exactly ONE shared thread (the
 * unique pair_key guard  no fork if both send a first message), and (b) carry
 * both messages. Live delivery is realtime-gated (Supabase), so it's a best-effort
 * check; the single-thread + persistence assertions are the hard guarantees.
 *
 * Pair: Pieter (counsellor · /app) ↔ Thandeka (hub · /hub)  no seeded thread.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const PW = "phila1234";
const PIETER = "pieter@masizakhe.org.za";
const THANDEKA = "thandeka@masizakhe.org.za";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** New message → search a colleague → open the thread → type + Send. */
async function sendNewMessage(page: Page, colleague: string, firstName: string, text: string) {
  await page.getByRole("button", { name: "New message" }).click();
  await page.getByPlaceholder("Search colleagues…").fill(firstName);
  await page.getByRole("button", { name: new RegExp(colleague) }).first().click();
  const box = page.getByPlaceholder(new RegExp(`Message ${firstName}`, "i"));
  await box.fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // The marker shows in both the bubble and the list preview  first() avoids strict mode.
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
}

test("two users exchanging first messages get ONE shared thread (no duplicate)", async ({ browser }) => {
  const pRows = await sql`SELECT id FROM "user" WHERE email = ${PIETER}` as { id: string }[];
  const tRows = await sql`SELECT id FROM "user" WHERE email = ${THANDEKA}` as { id: string }[];
  const pieterId = pRows[0]!.id;
  const thandekaId = tRows[0]!.id;
  const pairKey = `org_masizakhe:${[pieterId, thandekaId].sort().join(":")}`;

  // Start clean (any prior run), and clean up at the end regardless of outcome.
  const wipe = async () => {
    await sql`DELETE FROM team_messages WHERE thread_id IN (SELECT id FROM message_threads WHERE pair_key = ${pairKey})`;
    await sql`DELETE FROM thread_members WHERE thread_id IN (SELECT id FROM message_threads WHERE pair_key = ${pairKey})`;
    await sql`DELETE FROM message_threads WHERE pair_key = ${pairKey}`;
  };
  await wipe();

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    const pageA = await ctxA.newPage(); // Pieter (counsellor)
    const pageB = await ctxB.newPage(); // Thandeka (hub)
    await login(pageA, PIETER);
    await login(pageB, THANDEKA);
    await pageA.goto("/app/messages");
    await pageB.goto("/hub/messages");

    const markerA = `A2B ${Date.now()}`;
    const markerB = `B2A ${Date.now()}`;

    // Pieter → Thandeka: the FIRST message, which creates the thread.
    await sendNewMessage(pageA, "Thandeka Mbeki", "Thandeka", markerA);

    // Best-effort: did the hub receive it live (Supabase Realtime configured)?
    const liveDelivered = await pageB.getByText(markerA, { exact: false }).first()
      .isVisible({ timeout: 6_000 }).catch(() => false);
    console.log(`[messages-direct] live delivery to hub: ${liveDelivered ? "YES (realtime on)" : "no (realtime dormant — will verify via reload)"}`);

    // Thandeka → Pieter: a "new message" too. The pair_key guard must reuse the
    // SAME thread rather than forking a second one.
    await sendNewMessage(pageB, "Pieter van der Merwe", "Pieter", markerB);

    // HARD GUARANTEE #1: exactly one thread for the pair.
    const threads = await sql`SELECT id FROM message_threads WHERE pair_key = ${pairKey}` as { id: string }[];
    expect(threads.length).toBe(1);
    const threadId = threads[0]!.id;

    // HARD GUARANTEE #2: both messages landed in that one thread, from the right senders.
    const msgs = await sql`
      SELECT body, sender_user_id FROM team_messages
      WHERE thread_id = ${threadId} ORDER BY created_at` as { body: string; sender_user_id: string }[];
    expect(msgs.map((m) => m.body)).toEqual([markerA, markerB]);
    expect(msgs.find((m) => m.body === markerA)!.sender_user_id).toBe(pieterId);
    expect(msgs.find((m) => m.body === markerB)!.sender_user_id).toBe(thandekaId);

    // End-to-end: after a reload, Pieter's single conversation shows BOTH messages
    // (proves the shared thread + persistence, independent of realtime).
    await pageA.goto("/app/messages");
    await pageA.getByText("Thandeka Mbeki").first().click();
    await expect(pageA.getByText(markerA, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await expect(pageA.getByText(markerB, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await pageA.screenshot({ path: "screenshots/messages-direct-shared-thread.png", fullPage: true });
  } finally {
    await wipe();
    await ctxA.close();
    await ctxB.close();
  }
});
