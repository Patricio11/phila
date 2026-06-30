import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10  directory cluster is DB-backed. We write a service straight into
 * Postgres and confirm it surfaces on /hub/services (which reads `listServices`),
 * proving the read is real (not the mock fixture). Cleans up after itself.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("services page reflects a row written directly to the DB", async ({ page }) => {
  const id = `svc_e2e_${Date.now()}`;
  const name = `E2E Service ${Date.now()}`;
  await sql`INSERT INTO services (id, org_id, name, duration_min, price_cents)
    VALUES (${id}, 'org_masizakhe', ${name}, 45, 55000)`;
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await page.goto("/hub/services");
    // 4 seeded services + the 1 just inserted = 5 (proves the page reads the DB).
    await expect(page.getByRole("button", { name: "Remove service" })).toHaveCount(5, { timeout: 15_000 });
    await page.screenshot({ path: "screenshots/directory-services-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM services WHERE id = ${id}`;
  }
});
