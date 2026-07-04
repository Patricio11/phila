import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Smart client import — the org uploads a CSV/Excel export in *any* column order, we
 * auto-map the columns (data-shape beats the header, so a "Contact" column of emails
 * maps to Email even under a phone-ish name), they re-arrange anything we got wrong,
 * and import. No counsellor step: imported clients land unassigned. Asserted against
 * Postgres, then cleaned up.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);
const ORG = "org_masizakhe";

async function signIn(page: Page, email = "thandeka@masizakhe.org.za", password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/hub", { timeout: 30_000 });
}
const dialog = (page: Page) => page.getByRole("dialog");

test("upload a shuffled CSV, auto-map, re-arrange, and import — persisted to the DB", async ({ page }) => {
  const stamp = Date.now();
  const base = String(stamp).slice(-6); // 6 digits → unique 10-digit SA numbers this run
  const names = [`Import One ${stamp}`, `Import Two ${stamp}`, `Import Three ${stamp}`];
  const email = (i: number) => `import.${i}.${stamp}@example.org`;
  const phone = (i: number) => `082${base}${i}`; // 082 + 6 + 1 = 10 digits

  // Deliberately awkward: columns are shuffled, "Contact" holds emails (not phones),
  // "Cell" holds phones, and provinces are short aliases (GP / WC / KZN). A dumb
  // header-only mapper would put the emails under Phone.
  const csv = [
    "Full Name,Region,Contact,Cell",
    `${names[0]},GP,${email(0)},${phone(0)}`,
    `${names[1]},WC,${email(1)},${phone(1)}`,
    `${names[2]},KZN,${email(2)},${phone(2)}`,
  ].join("\n");

  try {
    await signIn(page);
    await page.goto("/hub/clients");
    await expect(page.getByRole("heading", { level: 2, name: "Clients" })).toBeVisible();

    // Open the big import modal.
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(dialog(page).filter({ hasText: "Import clients" })).toBeVisible();
    await expect(page.getByText(/Drop your file here/)).toBeVisible();
    await page.screenshot({ path: "screenshots/import-upload.png", fullPage: true });

    // Upload the CSV via the hidden file input.
    await page.locator('input[type="file"]').setInputFiles({
      name: `clients-${stamp}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    // The column mapper appears with all 4 required fields satisfied by auto-map.
    await expect(page.getByText("Required", { exact: true })).toBeVisible();
    await expect(page.getByText("3 ready to import")).toBeVisible();
    await page.screenshot({ path: "screenshots/import-mapper.png", fullPage: true });

    // The smart part: the email column ("Contact") was detected by data shape, so the
    // live preview shows the email address under the Email column, not the Phone one.
    const previewRow = dialog(page).locator("tbody tr").first();
    await expect(previewRow).toContainText(email(0));
    await expect(previewRow).toContainText(phone(0));
    await expect(previewRow).toContainText("Gauteng"); // GP alias resolved

    // The user controls the mapping: un-map the province column, then map it back —
    // proving the columns are theirs to arrange. Each Select button reads its current
    // field, so we can target it by that value.
    await dialog(page).getByRole("button", { name: "Province", exact: true }).click();
    await page.getByRole("option", { name: "Don't import", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Don't import", exact: true }).click();
    await page.getByRole("option", { name: "Province", exact: true }).click();
    await expect(page.getByText("3 ready to import")).toBeVisible();

    // Import.
    await dialog(page).getByRole("button", { name: /^Import 3 clients$/ }).click();
    await expect(dialog(page).filter({ hasText: "Import clients" })).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(/3 clients imported/)).toBeVisible();

    // Assert the rows in Postgres: unassigned, contacts + province correctly mapped.
    const rows = await sql`
      SELECT name, phone, email, province, primary_counsellor_id
      FROM clients WHERE org_id = ${ORG} AND name LIKE ${`Import %${stamp}`} ORDER BY name`;
    expect(rows.length).toBe(3);
    const one = rows.find((r) => r.name === names[0])!;
    expect(one.email).toBe(email(0));
    expect(one.phone).toBe(phone(0));
    expect(one.province).toBe("Gauteng");
    expect(one.primary_counsellor_id).toBeNull(); // bulk import never assigns a counsellor
  } finally {
    await sql`DELETE FROM clients WHERE org_id = ${ORG} AND name LIKE ${`Import %${stamp}`}`;
  }
});
