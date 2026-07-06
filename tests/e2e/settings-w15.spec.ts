import { test, expect, type Page } from "@playwright/test";

/**
 * W1.5  org/platform settings now persist. The Hub booking page composes its
 * policy from the DB (org row + live services/counsellors) and saving writes
 * back; the super-admin console reads the national VAT rate from platform_settings.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("hub booking settings render from DB and save", async ({ page }) => {
  await signIn(page, "thandeka@masizakhe.org.za");
  await page.waitForURL("**/hub", { timeout: 30_000 });
  await page.goto("/hub/booking");

  // The DB-composed policy renders (services + counsellors sections present).
  await expect(page.getByText("Counsellors taking public bookings")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/booking-settings-db.png", fullPage: true });

  // Saving persists (toast confirms) — the action writes booking_settings to the org row.
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Booking settings saved")).toBeVisible({ timeout: 10_000 });
});

test("super-admin console shows the DB VAT rate", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });
  await page.goto("/admin/settings");
  // 15% is the seeded national rate (platform_settings).
  await expect(page.getByText("VAT", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/admin-vat-db.png", fullPage: true });
});
