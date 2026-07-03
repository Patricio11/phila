import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10  booking PERSISTS. A full public booking through /o/masizakhe/book
 * creates a real client + a scheduled appointment (+ consent) in Postgres.
 * Cleans up the rows it creates.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

test("public booking creates a real client + appointment in the DB", async ({ page }) => {
  const name = `E2E Booker ${Date.now()}`;
  await page.goto("/o/masizakhe/book");

  // Step 0  service + modality + counsellor.
  await page.getByRole("button", { name: /Individual counselling/ }).first().click();
  await page.getByRole("button", { name: "In person" }).click();
  await page.getByRole("button", { name: /Any available/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 1  today is notice-filtered, so pick the 2nd open day, then a slot.
  await page.getByRole("button", { name: /^(mon|tue|wed|thu|fri)\s+\d+\s+\w+$/i }).nth(1).click();
  await page.getByRole("button", { name: /^\d{1,2}:\d{2}$/ }).first().click({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2  intake (required fields).
  await page.getByLabel(/Your full name/).fill(name);
  await page.getByLabel(/Mobile number/).fill("+27 82 000 0000");
  await page.getByLabel(/What would you like support with/).fill("E2E test booking.");
  await page.getByRole("radio", { name: "WhatsApp" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3  confirm: one Terms & Conditions acceptance (not a page of toggles), then book.
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(/You.?re booked/i)).toBeVisible({ timeout: 25_000 });
  await page.screenshot({ path: "screenshots/booking-persisted.png", fullPage: true });

  // The booking is real in the DB.
  const rows = await sql`SELECT c.id cid, a.id aid, a.state FROM clients c JOIN appointments a ON a.client_id = c.id WHERE c.name = ${name}`;
  expect(rows.length).toBe(1);
  expect(rows[0]!.state).toBe("scheduled");

  // Accepting the T&C granted the everyday consents (booking + notes are required).
  const cid = rows[0]!.cid as string;
  const purposes = (await sql`SELECT purpose FROM consents WHERE client_id = ${cid}`).map((r) => r.purpose);
  expect(purposes).toEqual(expect.arrayContaining(["booking", "notes"]));

  // Cleanup.
  await sql`DELETE FROM appointments WHERE client_id = ${cid}`;
  await sql`DELETE FROM consents WHERE client_id = ${cid}`;
  await sql`DELETE FROM clients WHERE id = ${cid}`;
});
