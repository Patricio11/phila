import { test, expect, type Page } from "@playwright/test";

/**
 * Settings + Billing reflect the trial countdown / plan and the verification status.
 * Uses the seeded Ubuntu admin (trialing, not-yet-verified) to exercise both.
 */
const UBUNTU_ADMIN = "staff1@ubuntu-community-care.example";

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("billing shows the trial countdown + plan; settings shows verification status", async ({ page }) => {
  await signIn(page, UBUNTU_ADMIN);
  await page.waitForURL((u) => /\/hub|\/welcome/.test(u.pathname), { timeout: 30_000 });

  // Billing: the Phila plan card with a trial countdown.
  await page.goto("/hub/billing");
  await expect(page.getByText("Your Phila plan")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Trial ·/)).toBeVisible();
  await expect(page.getByText(/free trial/)).toBeVisible();
  await page.screenshot({ path: "screenshots/billing-trial.png", fullPage: true });

  // Settings → Organisation: the verification status card.
  await page.goto("/hub/settings");
  await expect(page.getByText("Company verification").first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/settings-verification.png", fullPage: true });
});
