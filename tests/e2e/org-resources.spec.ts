import { test, expect, type Page } from "@playwright/test";

/**
 * W3.4/3.5 — plan management + metered resources on the org detail page.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("super-admin sees plan control + resource meters on an org", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });

  await page.goto("/admin/orgs/org_masizakhe");
  // Plan control + resource meters render.
  await expect(page.getByRole("heading", { name: "Plan", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Resources & quotas")).toBeVisible();
  await expect(page.getByText("SMS credits")).toBeVisible();
  await expect(page.getByText("AI spend (this month)")).toBeVisible();
  // Scroll it into view for the screenshot.
  await page.getByText("Resources & quotas").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/admin-org-plan-resources.png", fullPage: true });
});
