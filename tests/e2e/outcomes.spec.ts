import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.2  a counsellor records a PHQ-9 in the session editor and it persists to
 * `outcome_measures` (previously a toast-only no-op). Cleans up after itself.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);
const APPT = "appt_couns_nomsa_0"; // Nomsa ↔ Lerato

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill("nomsa@masizakhe.org.za");
  await page.locator('input[type="password"]').fill("phila1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 30_000 });
}

test("recording a PHQ-9 in the session editor persists to the DB", async ({ page }) => {
  const [appt] = await sql`SELECT client_id FROM appointments WHERE id = ${APPT}`;
  const clientId = appt!.client_id as string;
  await sql`DELETE FROM outcome_measures WHERE client_id = ${clientId} AND taken_at > now() - interval '1 hour'`;
  try {
    await signIn(page);
    await page.goto(`/app/sessions/${APPT}`);
    await page.getByRole("button", { name: /Record a measure/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Answer all 9 PHQ-9 items "Several days" (= 1 each → score 9).
    const opts = page.getByRole("button", { name: "Several days", exact: true });
    const n = await opts.count();
    for (let i = 0; i < n; i++) await opts.nth(i).click();

    await page.getByRole("button", { name: "Save measure" }).click();
    await expect(page.getByText(/PHQ-9 recorded/)).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () =>
      (await sql`SELECT score FROM outcome_measures WHERE client_id = ${clientId} AND tool = 'PHQ-9' AND taken_at > now() - interval '1 hour' ORDER BY taken_at DESC LIMIT 1`)[0]?.score ?? null,
    ).toBe(9);
  } finally {
    await sql`DELETE FROM outcome_measures WHERE client_id = ${clientId} AND taken_at > now() - interval '1 hour'`;
  }
});
