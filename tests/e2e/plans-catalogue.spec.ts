import { test, expect, type Page } from "@playwright/test";

/**
 * W3.4 — plan-catalogue CRUD. The super-admin edits a plan's price/quotas inline and
 * it persists (one change → every org on the plan). Screenshots the manager.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("super-admin edits a plan in the catalogue and it persists", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });

  await page.goto("/admin/plans");
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/admin-plans.png", fullPage: true });

  // Edit the Community plan's tagline — open the editor on its card.
  const card = page.locator("div.rounded-card").filter({ has: page.getByRole("heading", { name: "Community" }) });
  await card.getByRole("button", { name: "Edit" }).click();

  const tagline = card.getByLabel("Tagline");
  await expect(tagline).toBeVisible();
  const stamp = `Edited by e2e ${Date.now() % 100000}`;
  await tagline.fill(stamp);
  await card.getByRole("button", { name: "Save" }).click();

  // The toast confirms the persisted change; the new tagline shows on the card.
  await expect(page.getByText("Entitlements apply to every org on this plan — no drift.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(stamp)).toBeVisible();

  // Survives a reload → it was persisted, not just local state.
  await page.reload();
  await expect(page.getByText(stamp)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/admin-plans-edited.png", fullPage: true });

  // Restore the seed tagline so the demo catalogue stays clean.
  const card2 = page.locator("div.rounded-card").filter({ has: page.getByRole("heading", { name: "Community" }) });
  await card2.getByRole("button", { name: "Edit" }).click();
  await card2.getByLabel("Tagline").fill("For NGOs, faith-based & community services");
  await card2.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Entitlements apply to every org on this plan — no drift.")).toBeVisible({ timeout: 10_000 });
});
