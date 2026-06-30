import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10  billing cluster is DB-backed. An invoice written to Postgres for
 * Lerato surfaces on her /me/billing page (which reads `listClientInvoices`).
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("client billing page reflects an invoice written to the DB", async ({ page }) => {
  const id = `inv_e2e_${Date.now()}`;
  const number = `E2E-${Date.now()}`;
  await sql`INSERT INTO invoices (id, client_id, org_id, number, service_name, amount_cents, status, issued_at, due_at)
    VALUES (${id}, 'cl_lerato', 'org_masizakhe', ${number}, 'Individual counselling', 45000, 'unpaid', now(), now() + interval '14 days')`;
  try {
    await signIn(page, "lerato.m@example.co.za");
    await page.waitForURL("**/me", { timeout: 30_000 });
    await page.goto("/me/billing");
    await expect(page.getByText(number).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/billing-invoices-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  }
});
