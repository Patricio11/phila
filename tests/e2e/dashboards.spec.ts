import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — the Hub overview is computed from the DB (getHubOverview). We flip
 * Johan's risk flag in Postgres (the mock fixture has him NOT flagged), so his
 * safeguarding item in "Needs attention" can only have come from the DB
 * aggregation. Restored afterwards.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("hub overview reflects a risk flag set in the DB", async ({ page }) => {
  await sql`UPDATE clients SET risk_flag = true WHERE id = 'cl_johan'`;
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await expect(page.getByText(/Good (morning|afternoon|evening), Thandeka/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Johan Botha/).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/hub-overview-db.png", fullPage: true });
  } finally {
    await sql`UPDATE clients SET risk_flag = false WHERE id = 'cl_johan'`;
  }
});
