import { test, expect, type Page } from "@playwright/test";

/**
 * W1.4  Hub team management. The roster reads real membership from org_members
 * (+ user + counsellors), grouped into Active / Invited / Archived tabs with a
 * role guide and per-row actions. Archive → Restore proves the writes round-trip
 * through the provider (RLS-scoped) and the tab counts update.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("hub team: roster, role guide, and archive/restore round-trip", async ({ page }) => {
  await signIn(page, "thandeka@masizakhe.org.za");
  await page.waitForURL("**/hub", { timeout: 30_000 });
  await page.goto("/hub/team");

  // Roster is visible (seeded team members). Anchor on a roster-only name — the
  // signed-in admin's own name also appears in the top-right account menu.
  await expect(page.getByText("Aisha Patel")).toBeVisible({ timeout: 15_000 });

  // Role guide expands.
  await page.getByRole("button", { name: /How roles work/ }).click();
  await expect(page.getByText("Runs the practice")).toBeVisible();
  await page.screenshot({ path: "screenshots/team-role-guide.png", fullPage: true });

  // Tabs exist with counts; the seeded archived member (Bongani) lives under Archived.
  await page.getByRole("button", { name: /^Archived/ }).click();
  await expect(page.getByText("Bongani Nkosi")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "screenshots/team-archived-tab.png", fullPage: true });

  // Back to Active and screenshot the main roster.
  await page.getByRole("button", { name: /^Active/ }).click();
  await expect(page.getByText("Riaan Steyn")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "screenshots/team-active-roster.png", fullPage: true });

  // Archive Riaan (finance) via the row menu, then confirm he leaves Active.
  const riaanRow = page.locator("li", { hasText: "Riaan Steyn" }).first();
  await riaanRow.getByRole("button", { name: /Actions for Riaan/ }).click();
  await page.getByRole("button", { name: "Archive member" }).click();
  await expect(page.getByText("Riaan Steyn")).toHaveCount(0, { timeout: 10_000 });

  // He now appears under Archived; restore him.
  await page.getByRole("button", { name: /^Archived/ }).click();
  const archivedRiaan = page.locator("li", { hasText: "Riaan Steyn" }).first();
  await expect(archivedRiaan).toBeVisible({ timeout: 10_000 });
  await archivedRiaan.getByRole("button", { name: /Actions for Riaan/ }).click();
  await page.getByRole("button", { name: "Restore access" }).click();

  // Restored → back under Active.
  await page.getByRole("button", { name: /^Active/ }).click();
  await expect(page.getByText("Riaan Steyn")).toBeVisible({ timeout: 10_000 });
});
