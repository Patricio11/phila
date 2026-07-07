import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.1  a counsellor's session note now persists (was audit-only). Type it, sign
 * it, reload  the signed note comes back from `session_notes` via getSession.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);
const APPT = "appt_couns_nomsa_1";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill("nomsa@masizakhe.org.za");
  await page.locator('input[type="password"]').fill("phila1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 30_000 });
}

test("session note persists across a reload and stamps a signature", async ({ page }) => {
  const body = `E2E clinical note ${Date.now()}`;
  await sql`DELETE FROM session_notes WHERE appointment_id = ${APPT}`;
  try {
    await signIn(page);
    await page.goto(`/app/sessions/${APPT}`);
    const note = page.getByLabel("Private clinical note");
    await note.fill(body);
    await page.getByRole("button", { name: /Sign note/ }).click();
    await expect(page.getByText(/Note signed|Signed by/i).first()).toBeVisible({ timeout: 15_000 });

    // Persisted to the DB, signed.
    await expect.poll(async () =>
      (await sql`SELECT signed_at FROM session_notes WHERE appointment_id = ${APPT}`)[0]?.signed_at ?? null,
    ).not.toBeNull();

    // And it comes back on a fresh load (getSession reads the real note).
    await page.reload();
    await expect(page.getByLabel("Private clinical note")).toHaveValue(body);
  } finally {
    await sql`DELETE FROM session_notes WHERE appointment_id = ${APPT}`;
  }
});
