import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * LiveKit is a dual-provider platform integration: Phila self-hosted (Docker) or
 * LiveKit Cloud. This proves the super-admin can flip to Cloud, enter the Cloud
 * URL/key/secret, switch it on, and have it persist  so Cloud can be tested in
 * prod without standing up Docker.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signInAdmin(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill("ops@philasa.com");
  await page.locator('input[type="password"]').fill("phila1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30_000 });
}

test("switch LiveKit to Cloud, enter creds, switch on  persisted", async ({ page }) => {
  // Snapshot the existing (seeded) config so we can restore it  never clobber it.
  const [snap] = await sql`SELECT credentials_enc, enabled, updated_at FROM platform_integrations WHERE key = 'livekit'`;
  try {
    await signInAdmin(page);
    await page.goto("/admin/integrations/livekit");
    await expect(page.getByText("Video rooms · LiveKit")).toBeVisible();

    // Pick the LiveKit Cloud provider (the segmented toggle, not the switch-on button).
    await page.getByRole("button", { name: /LiveKit Cloud/ }).first().click();
    await page.getByPlaceholder(/your-project\.livekit\.cloud/).fill("wss://phila-e2e.livekit.cloud");
    await page.getByPlaceholder("API…").fill("APIe2etestkey");
    await page.getByPlaceholder(/Cloud API secret/).fill("e2e-cloud-secret-value");
    await page.getByRole("button", { name: /^Switch on/ }).click();

    // The card shows it's live on Cloud, and the DB row is enabled.
    await expect(page.getByText(/On · LiveKit Cloud/)).toBeVisible();
    await expect
      .poll(async () => (await sql`SELECT enabled FROM platform_integrations WHERE key = 'livekit'`)[0]?.enabled)
      .toBe(true);
    await page.screenshot({ path: "screenshots/livekit-cloud.png", fullPage: true });
  } finally {
    if (snap) {
      await sql`INSERT INTO platform_integrations (key, credentials_enc, enabled, updated_at)
        VALUES ('livekit', ${snap.credentials_enc}, ${snap.enabled}, ${snap.updated_at})
        ON CONFLICT (key) DO UPDATE SET credentials_enc = ${snap.credentials_enc}, enabled = ${snap.enabled}, updated_at = ${snap.updated_at}`;
    } else {
      await sql`DELETE FROM platform_integrations WHERE key = 'livekit'`;
    }
  }
});
