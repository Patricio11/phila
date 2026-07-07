import { test, expect, type Page } from "@playwright/test";

/**
 * Platform user management — the super-admin console lists operators and opens the
 * invite dialog. Screenshots the Users page + the invite modal.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("super-admin sees the Users page and can open the invite dialog", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });

  await page.goto("/admin/users");
  await expect(page.getByText("Platform users")).toBeVisible({ timeout: 15_000 });
  // The seeded operator row shows (anchor on the unique email — the name also appears
  // in the top-right account menu).
  await expect(page.getByText("ops@philasa.com")).toBeVisible();
  await page.screenshot({ path: "screenshots/admin-users.png", fullPage: true });

  await page.getByRole("button", { name: "Invite operator" }).click();
  await expect(page.getByRole("heading", { name: "Invite a platform operator" })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "screenshots/admin-invite-operator.png" });
});
