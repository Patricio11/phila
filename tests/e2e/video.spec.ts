import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 13  a REAL LiveKit call. Requires the local LiveKit server running
 * (cd phila_livekit && docker compose up). The counsellor opens an online
 * session's room, joins from the waiting room, and connects  the control bar +
 * a participant tile appear. Camera/mic are faked by the Playwright launch args.
 */
async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("counsellor joins the LiveKit room and the call connects", async ({ page }) => {
  await signIn(page, "nomsa@masizakhe.org.za");
  await page.waitForURL("**/app", { timeout: 30_000 });

  // appt_couns_nomsa_2 is a seeded ONLINE session for Nomsa.
  await page.goto("/room/appt_couns_nomsa_2");

  // Waiting room (pre-join)  start the session.
  const startBtn = page.getByRole("button", { name: /Start session|Join session/ });
  await expect(startBtn).toBeVisible({ timeout: 25_000 });
  await page.screenshot({ path: "screenshots/video-waiting-room.png", fullPage: true });
  await startBtn.click();

  // Connected  LiveKit's control bar + a participant tile render.
  await expect(page.locator(".lk-control-bar")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".lk-participant-tile").first()).toBeVisible({ timeout: 40_000 });
  await page.screenshot({ path: "screenshots/video-room.png", fullPage: true });

  // The camera toggle exists (switch video off → audio-only call).
  await expect(page.getByRole("button", { name: /camera/i }).first()).toBeVisible();

  // Leave cleanly.
  await page.getByRole("button", { name: /leave/i }).first().click();
});
