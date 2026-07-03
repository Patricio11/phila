import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Insights = the single analytics home. Reporting is folded in as the "Funder
 * reporting" tab (gone from the sidebar; the old route redirects). Both tabs render
 * real donut charts.
 */
readFileSync(".env.local", "utf8"); // ensures the env file exists in CI parity

async function signIn(page: Page, email = "thandeka@masizakhe.org.za", password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/hub", { timeout: 30_000 });
}

test("Reporting is merged into Insights (not in the sidebar) and the old route redirects", async ({ page }) => {
  await signIn(page);
  // No "Reporting" nav item any more.
  await expect(page.getByRole("link", { name: "Reporting", exact: true })).toHaveCount(0);
  // Old route redirects to Insights.
  await page.goto("/hub/reporting");
  await expect(page).toHaveURL(/\/hub\/insights$/);
});

test("Insights shows both tabs with donut charts", async ({ page }) => {
  await signIn(page);
  await page.goto("/hub/insights");
  await expect(page.getByRole("heading", { level: 2, name: "Insights" })).toBeVisible();

  // Practice tab: session-mix donut + client-mix donuts.
  await expect(page.getByRole("tab", { name: "Practice" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Session mix this period")).toBeVisible();
  await expect(page.getByText("By location")).toBeVisible(); // practice-only mix donut
  // Donuts draw SVG arcs.
  expect(await page.locator("main svg circle").count()).toBeGreaterThan(2);
  await page.screenshot({ path: "screenshots/insights-practice.png", fullPage: true });

  // Funder reporting tab: narrative + k-anon donut breakdowns.
  await page.getByRole("tab", { name: /Funder reporting/ }).click();
  await expect(page.getByText("Funder narrative")).toBeVisible();
  await expect(page.getByText("By population group")).toBeVisible();
  await expect(page.getByText(/too few to report/i).first()).toBeVisible();
  await page.screenshot({ path: "screenshots/insights-funder.png", fullPage: true });
});
