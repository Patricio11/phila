import { test, expect } from "@playwright/test";

/**
 * Phase 9  real auth end-to-end. Each demo button signs in through Better Auth
 * (real session cookie) and lands on that role's home, resolved from the DB.
 * Screenshots land in ./screenshots as living proof of each verified flow.
 */
const ROLES = [
  { label: "Counsellor", home: "/app" },
  { label: "Practice admin", home: "/hub" },
  { label: "Client", home: "/me" },
  { label: "Funder", home: "/funder" },
];

for (const role of ROLES) {
  test(`signs in as ${role.label} and lands on ${role.home}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: role.label, exact: true }).click();
    await page.waitForURL(`**${role.home}`, { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`${role.home.replace(/\//g, "\\/")}(\\/|$|\\?)`));
    // Let the streamed RSC content settle so the screenshot is real proof.
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).not.toBeEmpty();
    await page.screenshot({
      path: `screenshots/login-${role.label.toLowerCase().replace(/\s+/g, "-")}.png`,
      fullPage: true,
    });
  });
}

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill("nomsa@masizakhe.org.za");
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/wrong email or password/i)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
});

test("guards redirect an unauthenticated visit to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/hub");
  await page.waitForURL("**/login", { timeout: 30_000 });
  await expect(page).toHaveURL(/\/login/);
});
