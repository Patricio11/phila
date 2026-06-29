import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — funders cluster is DB-backed. A funder written to Postgres surfaces
 * on /hub/funders (which reads `listFunders`). Cleans up after itself.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("hub funders page reflects a funder written to the DB", async ({ page }) => {
  const id = `fnd_e2e_${Date.now()}`;
  const name = `E2E Foundation ${Date.now()}`;
  await sql`INSERT INTO funders (id, org_id, name, type, contact_name, contact_email)
    VALUES (${id}, 'org_masizakhe', ${name}, 'foundation', 'Test Contact', 'contact@example.org')`;
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await page.goto("/hub/funders");
    // The page summarises "{N} funders" from listFunders — 3 seeded + 1 inserted.
    await expect(page.getByText(/\b4 funders\b/)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/funders-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM funders WHERE id = ${id}`;
  }
});
