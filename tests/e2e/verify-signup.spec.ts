import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.8  signup now requires email verification. Sign-up shows a "check your email"
 * state and starts the trial; sign-in is refused until verified (with a resend
 * affordance). Once verified, sign-in lands the org admin in the welcome/hub flow.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const EMAIL = "verify.probe@example.com";
const ORG_ID = "org_e2e_verify_probe";
const PRACTICE = "E2E Verify Probe";

async function cleanup() {
  const users = (await sql`SELECT id FROM "user" WHERE email=${EMAIL}`).map((r) => r.id);
  await sql`DELETE FROM subscriptions WHERE org_id=${ORG_ID}`;
  await sql`DELETE FROM org_members WHERE org_id=${ORG_ID}`;
  await sql`DELETE FROM orgs WHERE id=${ORG_ID}`;
  if (users.length) {
    await sql`DELETE FROM account WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM session WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM "user" WHERE id = ANY(${users})`;
  }
  await sql`DELETE FROM verification WHERE identifier LIKE ${"%" + EMAIL + "%"}`;
}

async function fill(page: Page) {
  await page.getByPlaceholder("e.g. Masizakhe Counselling").fill(PRACTICE);
  await page.locator('input[autocomplete="name"]').fill("Probe Admin");
  await page.getByPlaceholder("you@practice.co.za").fill(EMAIL);
  await page.locator('input[type="password"]').fill("probe-pass-123");
  await page.getByRole("button", { name: /I agree to Phila/ }).click();
}

test("signup requires verification, gates login, then lets a verified admin in", async ({ page }) => {
  await cleanup();
  try {
    // Sign up with a plan carried from the landing page → trial reflects it.
    await page.goto("/signup?plan=p_programme");
    await expect(page.getByText(/Starting your 17-day free trial on the Programme plan/)).toBeVisible();
    await fill(page);
    await page.getByRole("button", { name: "Create your practice" }).click();

    // "Check your email" state (no session yet).
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/signup-check-email.png", fullPage: true });

    // The trial was created on the chosen plan.
    const [sub] = await sql`SELECT plan_id, status FROM subscriptions WHERE org_id=${ORG_ID}`;
    expect(sub?.plan_id).toBe("p_programme");
    expect(sub?.status).toBe("trialing");

    // Sign-in is refused until verified → the verify banner appears.
    await page.goto("/login");
    await page.getByPlaceholder("you@practice.co.za").fill(EMAIL);
    await page.locator('input[type="password"]').fill("probe-pass-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Verify your email to continue")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/login-verify-gate.png", fullPage: true });

    // Verify the address (as clicking the email link would) and sign in successfully.
    await sql`UPDATE "user" SET email_verified = true WHERE email=${EMAIL}`;
    await page.reload();
    await page.getByPlaceholder("you@practice.co.za").fill(EMAIL);
    await page.locator('input[type="password"]').fill("probe-pass-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((u) => /\/hub|\/welcome/.test(u.pathname), { timeout: 30_000 });
    expect(/\/hub|\/welcome/.test(page.url())).toBe(true);
  } finally {
    await cleanup();
  }
});
