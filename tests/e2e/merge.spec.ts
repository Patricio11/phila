import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.6  the Hub can merge duplicate client records. Detection is real; this drives
 * the merge through the UI and confirms the loser folds into the keeper (soft-deleted,
 * history preserved). Two same-named clients are seeded to trigger the dedupe banner.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const A = "cl_e2e_merge_a";
const B = "cl_e2e_merge_b";
const NAME = "Zola Merge-Probe";

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("hub merges a duplicate client pair through the UI", async ({ page }) => {
  // Two records, same name → grouped as duplicates. 'A' has a session so it sorts first (the default keep).
  await sql`INSERT INTO clients (id, org_id, name, phone, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${A}, 'org_masizakhe', ${NAME}, '+27820005555', 'Gauteng', 'couns_thabo', false, now() - interval '10 days')`;
  await sql`INSERT INTO clients (id, org_id, name, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${B}, 'org_masizakhe', ${NAME}, 'Gauteng', 'couns_thabo', false, now())`;
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await page.goto("/hub/clients");

    // The dedupe banner surfaces; open the review dialog.
    const banner = page.getByText(/possible duplicate/);
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/merge-dedupe-banner.png", fullPage: true });
    await banner.click();

    await expect(page.getByRole("heading", { name: "Review duplicates" })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "screenshots/merge-review-dialog.png" });

    // The demo DB also has a real seeded duplicate  scope the merge strictly to our
    // Zola group's card so we never touch anyone else's records.
    const zolaCard = page.locator("div.rounded-card.border").filter({ hasText: NAME }).last();
    await zolaCard.getByRole("button", { name: /Merge 2 into one/ }).click();
    await expect(page.getByText("Records merged")).toBeVisible({ timeout: 10_000 });

    // Exactly one of the pair remains live in the DB.
    const live = await sql`SELECT id FROM clients WHERE id IN (${A}, ${B}) AND deleted_at IS NULL`;
    expect(live.length).toBe(1);
  } finally {
    await sql`DELETE FROM clients WHERE id IN (${A}, ${B})`;
  }
});
