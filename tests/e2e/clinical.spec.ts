import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10  clinical cluster is DB-backed. A document written straight to
 * Postgres for Lerato surfaces on her /me/documents page (which reads
 * `listClientDocuments`). Cleans up after itself.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("client documents page reflects a row written to the DB", async ({ page }) => {
  const id = `doc_e2e_${Date.now()}`;
  const name = `E2E Care summary ${Date.now()}`;
  await sql`INSERT INTO client_documents (id, client_id, org_id, name, kind, size_label, shared_by, created_at)
    VALUES (${id}, 'cl_lerato', 'org_masizakhe', ${name}, 'report', '1 page', 'counsellor', now())`;
  try {
    await signIn(page, "lerato.m@example.co.za");
    await page.waitForURL("**/me", { timeout: 30_000 });
    await page.goto("/me/documents");
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/clinical-documents-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM client_documents WHERE id = ${id}`;
  }
});
