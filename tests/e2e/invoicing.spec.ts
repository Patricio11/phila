import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — invoicing WRITES persist. Marking an invoice paid in the Hub
 * (markInvoicePaid → db/queries/settings) flips its status in Postgres. Restores.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("marking an invoice paid persists status='paid' to the DB", async ({ page }) => {
  await sql`UPDATE invoices SET status = 'unpaid' WHERE id = 'inv_s1'`; // ensure starting state
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await page.goto("/hub/invoicing");

    // MZ-2026-0145 (inv_s1) is the first unpaid row, so its is the first "Mark paid".
    await expect(page.getByText("MZ-2026-0145")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Mark paid" }).first().click();

    await expect.poll(async () => (await sql`SELECT status FROM invoices WHERE id = 'inv_s1'`)[0]!.status, { timeout: 15_000 }).toBe("paid");
  } finally {
    await sql`UPDATE invoices SET status = 'unpaid' WHERE id = 'inv_s1'`;
  }
});
