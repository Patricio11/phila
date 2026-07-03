import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Hub UI consistency + org portal policy (this session's work): tabbed Settings,
 * the client-portal toggles (persisted), the 3-up Services grid, top-bar↔content
 * alignment (collapsed + expanded), and the landing page featuring Forms.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email = "thandeka@masizakhe.org.za", password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/hub", { timeout: 30_000 });
}

test("client-portal 'invite on create' toggle persists to the org", async ({ page }) => {
  await signIn(page);
  try {
    await page.goto("/hub/settings");
    await page.getByText("Invite when adding a client").scrollIntoViewIfNeeded();
    await page.getByRole("switch", { name: /Turn on Invite when adding a client/i }).click();
    await expect
      .poll(async () => (await sql`SELECT client_portal FROM orgs WHERE id = 'org_masizakhe'`)[0]!.client_portal?.inviteOnCreate)
      .toBe(true);
    await page.screenshot({ path: "screenshots/portal-settings.png", fullPage: true });
  } finally {
    await sql`UPDATE orgs SET client_portal = '{}'::jsonb WHERE id = 'org_masizakhe'`;
  }
});

test("Settings is grouped into tabs", async ({ page }) => {
  await signIn(page);
  await page.goto("/hub/settings");
  await expect(page.getByRole("tab", { name: /Organisation/ })).toBeVisible();

  await page.getByRole("tab", { name: /Billing & plan/ }).click();
  await expect(page.getByText("Invoicing & VAT")).toBeVisible();

  await page.getByRole("tab", { name: /Integrations/ }).click();
  await expect(page.getByText("Platform features")).toBeVisible();

  await page.getByRole("tab", { name: /Security/ }).click();
  await expect(page.getByRole("tab", { name: /Security/ })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "screenshots/settings-tabs.png", fullPage: true });
});

test("Services render in a 3-up grid", async ({ page }) => {
  await signIn(page);
  await page.goto("/hub/services");
  const inputs = page.getByPlaceholder(/e\.g\. Individual counselling/);
  await inputs.first().waitFor();
  // The services grid is 3-up on desktop.
  const grid = page.locator('[class*="lg:grid-cols-3"]').filter({ has: inputs.first() });
  await expect(grid).toBeVisible();
  // Three service cards sit on the same row (same Y) at desktop width.
  expect(await inputs.count()).toBeGreaterThanOrEqual(3);
  const y0 = (await inputs.nth(0).boundingBox())!.y;
  const y2 = (await inputs.nth(2).boundingBox())!.y;
  expect(Math.abs(y0 - y2)).toBeLessThan(4); // first three share a row
});

test("top bar lines up with page content, collapsed and expanded", async ({ page }) => {
  await signIn(page);
  await page.goto("/hub/clients");
  await page.waitForSelector("main h2");

  const measure = () =>
    page.evaluate(() => {
      const top = document.querySelector("header h1")?.getBoundingClientRect().left ?? -1;
      const body = document.querySelector("main h2")?.getBoundingClientRect().left ?? -2;
      return { top: Math.round(top), body: Math.round(body) };
    });

  const expanded = await measure();
  expect(expanded.top).toBe(expanded.body);

  await page.getByRole("button", { name: /Collapse sidebar/i }).click();
  await page.waitForTimeout(400);
  const collapsed = await measure();
  expect(collapsed.top).toBe(collapsed.body);
  expect(collapsed.top).toBeLessThan(expanded.top); // sidebar got narrower
});

test("landing page features Forms and Documents", async ({ page }) => {
  await page.goto("/");
  await page.getByText("One calm place", { exact: false }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Forms & assessments")).toBeVisible();
  await expect(page.getByText("Documents & files")).toBeVisible();
  await page.screenshot({ path: "screenshots/landing-forms.png", fullPage: true });
});

test("Terms & Conditions page renders the consent detail + crisis line", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Confidential clinical notes/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Anonymous funder reporting/ })).toBeVisible();
  await expect(page.getByText("0800 567 567")).toBeVisible();
  await page.screenshot({ path: "screenshots/terms-page.png", fullPage: true });
});
