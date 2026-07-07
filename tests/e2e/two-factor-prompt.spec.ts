import { test, expect, type Page } from "@playwright/test";

/**
 * W2 — the skippable 2FA nudge. A privileged user without 2FA sees a dismissible
 * banner on their dashboard (never a redirect/block). Dismissing hides it.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("org admin without 2FA sees a dismissible security nudge on the dashboard", async ({ page }) => {
  await signIn(page, "thandeka@masizakhe.org.za");
  await page.waitForURL("**/hub", { timeout: 30_000 });

  // Lands on the dashboard (no redirect) with the nudge banner.
  const banner = page.getByText("Protect your account with two-factor authentication.");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/two-factor-banner.png", fullPage: true });

  // "Remind me later" (×) hides it.
  await page.getByRole("button", { name: "Remind me later" }).click();
  await expect(banner).toHaveCount(0, { timeout: 10_000 });
});
