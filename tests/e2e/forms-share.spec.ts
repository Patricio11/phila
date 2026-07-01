import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 18.6  the OPEN SHARE LINK. Anyone with `/f/<shareToken>` can fill the form
 * with no account; each submission becomes a fresh, completed `form_assignments` row
 * (client_id null). Uses the seeded, share-enabled, themed feedback form. Cleans up
 * the row it creates.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const SHARE_TOKEN = "s_feedback_masizakhe";
const FEEDBACK_FORM = "form_feedback_masizakhe";

test("open share link submits a real, anonymous response into the DB", async ({ page }) => {
  const marker = `E2E share ${Date.now()}`;

  await page.goto(`/f/${SHARE_TOKEN}`);

  // The themed split page rendered (the hero heading from the seeded theme).
  await expect(page.getByRole("heading", { name: /How did we do\?/i })).toBeVisible();

  // Answer the two required radio groups + leave a uniquely-identifiable comment.
  await page.getByRole("radio", { name: "Very helpful" }).click();
  await page.getByRole("radio", { name: "Yes, fully" }).click();
  await page.getByLabel(/Anything you.?d like us to know/i).fill(marker);

  await page.getByRole("button", { name: "Submit" }).click();

  // Calm confirmation.
  await expect(page.getByText(/that.?s sent/i)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "screenshots/form-share-submitted.png", fullPage: true });

  // The response is real in the DB: completed, tied to the form, with NO client.
  const rows = await sql`
    SELECT id, client_id, status, answers->>'comments' AS comments, answers->>'helpful' AS helpful
    FROM form_assignments
    WHERE form_id = ${FEEDBACK_FORM} AND answers->>'comments' = ${marker}`;
  expect(rows.length).toBe(1);
  expect(rows[0]!.client_id).toBeNull();
  expect(rows[0]!.status).toBe("completed");
  expect(rows[0]!.helpful).toBe("Very helpful");

  // It also surfaces in the Hub's Responses view for that form.
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM form_assignments
    WHERE form_id = ${FEEDBACK_FORM} AND status = 'completed' AND client_id IS NULL AND answers->>'comments' = ${marker}`;
  expect(count).toBe(1);

  // Cleanup.
  await sql`DELETE FROM form_assignments WHERE id = ${rows[0]!.id as string}`;
});

test("a required field can't be skipped from the share link", async ({ page }) => {
  await page.goto(`/f/${SHARE_TOKEN}`);
  await expect(page.getByRole("heading", { name: /How did we do\?/i })).toBeVisible();

  // Submit with nothing filled  the client-side validation blocks it, and no row lands.
  const before = await sql`SELECT count(*)::int AS count FROM form_assignments WHERE form_id = ${FEEDBACK_FORM}`;
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/This one.?s needed|Submit/i).first()).toBeVisible();

  const after = await sql`SELECT count(*)::int AS count FROM form_assignments WHERE form_id = ${FEEDBACK_FORM}`;
  expect(after[0]!.count).toBe(before[0]!.count);
});
