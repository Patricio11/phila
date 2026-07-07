import { test, expect, type Page } from "@playwright/test";

/**
 * W3 — platform feature governance. Screenshots the global feature-control matrix and
 * the per-org feature entitlement panel on an org detail page.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("super-admin sees global feature control + per-org entitlements", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });

  // Global feature control matrix.
  await page.goto("/admin/features");
  await expect(page.getByText("AI scribe")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Turn a feature off across the whole platform.")).toBeVisible();
  await page.screenshot({ path: "screenshots/admin-features.png", fullPage: true });

  // Per-org entitlement panel with effective state + override controls.
  await page.goto("/admin/orgs/org_masizakhe");
  await expect(page.getByRole("button", { name: "Force on" }).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/admin-org-features.png", fullPage: true });
});
