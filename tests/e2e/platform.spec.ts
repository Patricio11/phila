import { test, expect, type Page } from "@playwright/test";

/**
 * W1.7  the super-admin console reads every tenant + the audit trail from the DB.
 * Signs in as the platform operator and screenshots the overview + orgs + audit.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("super-admin console renders tenants, orgs, and audit from the DB", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });

  // Overview shows the real multi-tenant roll-up.
  await expect(page.getByText(/Masizakhe Counselling/).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/admin-overview-db.png", fullPage: true });

  // Orgs list  the 5 real tenants.
  await page.goto("/admin/orgs");
  await expect(page.getByText("Thrive EAP")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Khula Trust")).toBeVisible();
  await page.screenshot({ path: "screenshots/admin-orgs-db.png", fullPage: true });

  // Audit trail from the real audit_log.
  await page.goto("/admin/audit");
  await page.screenshot({ path: "screenshots/admin-audit-db.png", fullPage: true });
});
