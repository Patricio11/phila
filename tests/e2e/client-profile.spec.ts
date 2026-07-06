import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.3 — the client edits their own profile and it persists (was audit-only). The
 * address lives in clients.profile jsonb. Restores the profile afterwards.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);
const CID = "cl_lerato";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill("lerato.m@example.co.za");
  await page.locator('input[type="password"]').fill("phila1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/me", { timeout: 30_000 });
}

test("client profile edit persists across a reload", async ({ page }) => {
  const address = `${Date.now()} Test Street, Jozi`;
  const before = (await sql`SELECT profile FROM clients WHERE id = ${CID}`)[0]?.profile ?? {};
  try {
    await signIn(page);
    await page.goto("/me/profile");
    const addr = page.getByPlaceholder("Street, suburb, city, postal code");
    await addr.fill(address);
    await page.getByRole("button", { name: "Save my details" }).click();
    await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () =>
      ((await sql`SELECT profile FROM clients WHERE id = ${CID}`)[0]?.profile as Record<string, string>)?.address ?? null,
    ).toBe(address);

    await page.reload();
    await expect(page.getByPlaceholder("Street, suburb, city, postal code")).toHaveValue(address);
  } finally {
    await sql`UPDATE clients SET profile = ${JSON.stringify(before)}::jsonb WHERE id = ${CID}`;
  }
});
