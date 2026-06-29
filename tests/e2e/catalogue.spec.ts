import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — catalogue WRITES persist. Editing a service in the Hub UI saves to
 * Postgres (the saveServices action → db/queries/catalogue). Restores afterwards.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("editing a service in the UI persists to the DB", async ({ page }) => {
  const newName = `Edited Service ${Date.now()}`;
  await signIn(page, "thandeka@masizakhe.org.za");
  await page.waitForURL("**/hub", { timeout: 30_000 });
  await page.goto("/hub/services");

  const firstNameInput = page.locator("input.font-medium").first();
  const original = await firstNameInput.inputValue();
  await firstNameInput.fill(newName);
  await page.getByRole("button", { name: /Save services/ }).click();
  await expect(page.getByText(/Services saved/i)).toBeVisible({ timeout: 15_000 });

  const rows = await sql`SELECT id FROM services WHERE org_id = 'org_masizakhe' AND name = ${newName}`;
  expect(rows.length).toBe(1);

  // Restore the original name.
  await sql`UPDATE services SET name = ${original} WHERE id = ${rows[0]!.id}`;
});
