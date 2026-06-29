import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 12 — the hub manages its own message wording. Editing a template in
 * Settings → Notifications writes an org-override row in message_templates
 * (the system default is the fallback). Cleans up after itself.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("hub edits a message template and it persists as an org override", async ({ page }) => {
  const newBody = `Hi {clientName}, custom E2E confirmation ${Date.now()}.`;
  await sql`DELETE FROM message_templates WHERE org_id='org_masizakhe' AND channel='whatsapp' AND key='booked'`;
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await page.goto("/hub/settings/notifications");
    await expect(page.getByText("Message templates")).toBeVisible({ timeout: 15_000 });

    // First template row is WhatsApp · Booking confirmed. (exact: "Edit" must not
    // substring-match "Buy cr-edit-s".)
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const editor = page.locator("textarea").first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.fill(newBody);
    await page.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect(page.getByText("Template saved")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/notifications-templates.png", fullPage: true });

    const rows = await sql`SELECT body FROM message_templates WHERE org_id='org_masizakhe' AND channel='whatsapp' AND key='booked'`;
    expect(rows.length).toBe(1);
    expect(rows[0]!.body).toBe(newBody);
  } finally {
    await sql`DELETE FROM message_templates WHERE org_id='org_masizakhe' AND channel='whatsapp' AND key='booked'`;
  }
});
