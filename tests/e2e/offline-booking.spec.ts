import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 11 — offline send-queue. A booking completed while offline is queued
 * durably (IndexedDB) with an honest "saved, not sent" state, then replayed on
 * reconnect — landing a real appointment in Postgres (the server's availability
 * check runs on replay). Nothing fake-"sends".
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

test("a booking made offline queues, then syncs to the DB on reconnect", async ({ page, context }) => {
  const name = `Offline Booker ${Date.now()}`;
  await page.goto("/o/masizakhe/book");

  // Drive the wizard (online, so slots load).
  await page.getByRole("button", { name: /Individual counselling/ }).first().click();
  await page.getByRole("button", { name: "In person" }).click();
  await page.getByRole("button", { name: /Any available/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^(mon|tue|wed|thu|fri)\s+\d+\s+\w+$/i }).nth(1).click();
  await page.getByRole("button", { name: /^\d{1,2}:\d{2}$/ }).first().click({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Your full name/).fill(name);
  await page.getByLabel(/Mobile number/).fill("+27 82 000 0000");
  await page.getByLabel(/What would you like support with/).fill("Offline booking test.");
  await page.getByRole("radio", { name: "WhatsApp" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  for (const sw of await page.getByRole("switch").all()) await sw.click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Go offline, then confirm → it must QUEUE, not send.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(/Saved on your device/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Offline — 1 queued/i)).toBeVisible({ timeout: 10_000 });

  // Nothing in the DB yet.
  expect((await sql`SELECT count(*)::int n FROM clients WHERE name = ${name}`)[0]!.n).toBe(0);
  await page.screenshot({ path: "screenshots/offline-queued.png", fullPage: true });

  // Reconnect → the queue flushes → a real booking lands.
  await context.setOffline(false);
  await expect
    .poll(async () => (await sql`SELECT count(*)::int n FROM clients WHERE name = ${name}`)[0]!.n, { timeout: 25_000 })
    .toBe(1);

  const [row] = await sql`SELECT c.id cid, a.state FROM clients c JOIN appointments a ON a.client_id = c.id WHERE c.name = ${name}`;
  expect(row!.state).toBe("scheduled");

  await sql`DELETE FROM appointments WHERE client_id = ${row!.cid}`;
  await sql`DELETE FROM consents WHERE client_id = ${row!.cid}`;
  await sql`DELETE FROM clients WHERE id = ${row!.cid}`;
});
