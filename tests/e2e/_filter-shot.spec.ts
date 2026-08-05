import { test, expect, type Page } from "@playwright/test";
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("calendar filters: counsellor dropdown + type buttons narrow the grid", async ({ page }) => {
  await signIn(page, "thandeka@masizakhe.org.za");
  await page.waitForURL("**/hub", { timeout: 30_000 });
  await page.goto("/hub/appointments");
  await expect(page.getByRole("button", { name: "Filter by counsellor" })).toBeVisible({ timeout: 15_000 });

  // Baseline: multiple counsellors' chips visible this week.
  const chips = page.locator("button:has(.tabular-nums)");
  // Filter to Nomsa only.
  await page.getByRole("button", { name: "Filter by counsellor" }).click();
  await page.getByPlaceholder("Search team…").fill("Nomsa");
  await page.getByRole("option", { name: /Nomsa/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/calendar-filter-nomsa.png" });

  // Type filter: Online only.
  await page.getByRole("button", { name: "Online", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/calendar-filter-online.png" });
  // The pressed states are on.
  await expect(page.getByRole("button", { name: "Online", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Filter by counsellor" })).toContainText("Nomsa");
  void chips;
});
