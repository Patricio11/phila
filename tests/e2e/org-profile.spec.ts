import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.5  the org profile is real: no more hardcoded fake registration numbers, and
 * an edit persists to the org row + survives a reload. Restores the profile after.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill("thandeka@masizakhe.org.za");
  await page.locator('input[type="password"]').fill("phila1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/hub", { timeout: 30_000 });
}

test("org profile persists and shows no fake seed numbers", async ({ page }) => {
  const reg = `NPO ${Date.now()}`;
  const before = (await sql`SELECT profile FROM orgs WHERE id = 'org_masizakhe'`)[0]?.profile ?? {};
  try {
    await signIn(page);
    await page.goto("/hub/settings");
    // The old hardcoded fakes must be gone.
    await expect(page.getByText("2018/445566/08")).toHaveCount(0);
    await expect(page.getByText("BHF 0556789")).toHaveCount(0);

    // Edit the registration number and save.
    const regInput = page.getByPlaceholder("e.g. 123-456 NPO");
    await regInput.fill(reg);
    await page.getByRole("button", { name: "Save organisation" }).click();

    // Persisted to the org row.
    await expect.poll(async () =>
      ((await sql`SELECT profile FROM orgs WHERE id = 'org_masizakhe'`)[0]?.profile as Record<string, string>)?.registrationNo ?? null,
    ).toBe(reg);

    // And it survives a reload.
    await page.reload();
    await expect(page.getByPlaceholder("e.g. 123-456 NPO")).toHaveValue(reg);
  } finally {
    await sql`UPDATE orgs SET profile = ${JSON.stringify(before)}::jsonb WHERE id = 'org_masizakhe'`;
  }
});
