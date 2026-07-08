import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Phase 9 completion  consent persistence, real sign-up, and TOTP 2FA (enrol +
 * the sign-in challenge that ONLY appears for users who enabled it). Screenshots
 * land in ./screenshots. Throwaway practices are used for sign-up/2FA so the
 * seeded demo accounts stay clean.
 */

/** Standard TOTP (SHA1, 6 digits, 30s)  matches Better Auth's default. */
function totp(secretB32: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("consent change persists across a reload (DB-backed)", async ({ page }) => {
  await signIn(page, "lerato.m@example.co.za");
  await page.waitForURL("**/me", { timeout: 30_000 });
  await page.goto("/me/consent");

  const firstSwitch = page.getByRole("switch").first();
  await expect(firstSwitch).toBeVisible();
  const before = await firstSwitch.getAttribute("aria-checked");
  const flipped = before === "true" ? "false" : "true";

  // The toggle fires a Server Action POST to this page; wait for it to persist.
  const save1 = page.waitForResponse((r) => r.request().method() === "POST");
  await firstSwitch.click();
  await expect(firstSwitch).toHaveAttribute("aria-checked", flipped);
  await save1;

  await page.reload();
  const reloaded = page.getByRole("switch").first();
  await expect(reloaded).toHaveAttribute("aria-checked", flipped); // persisted in the DB
  await page.screenshot({ path: "screenshots/consent-persisted.png", fullPage: true });

  // Restore the original state so the seed stays as-is.
  const save2 = page.waitForResponse((r) => r.request().method() === "POST");
  await reloaded.click();
  await save2;
});

test("sign-up creates a real practice and asks the founder to verify their email", async ({ page }) => {
  // Signup is verification-first (W1.8: SIGNUP → VERIFY → ONBOARDING → APPROVAL). After
  // submitting, the founder lands on a "check your email" step — a real verification link
  // must be clicked before onboarding, so the test asserts that gate rather than /onboarding.
  const stamp = Date.now();
  const email = `founder-${stamp}@example.co.za`;
  await page.goto("/signup");
  await page.getByPlaceholder("e.g. Masizakhe Counselling").fill(`Test Practice ${stamp}`);
  await page.locator('input[autocomplete="name"]').fill("Test Founder");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill("phila1234");
  await page.getByText(/I agree to Phila/i).click();
  await page.getByRole("button", { name: /create|get started|sign up/i }).first().click();
  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("button", { name: /resend verification/i })).toBeVisible();
  await page.screenshot({ path: "screenshots/signup-verify-email.png", fullPage: true });
});

test("2FA: enrol on a counsellor, then sign-in requires the code (only for enrolled users)", async ({ page, context }) => {
  // Pieter is a seeded counsellor not used by any other test, so 2FA on him is isolated.
  const email = "pieter@masizakhe.org.za";
  await signIn(page, email);
  await page.waitForURL("**/app", { timeout: 30_000 });

  // Enrol 2FA in account settings  capture the TOTP secret from the enable response.
  await page.goto("/app/settings");
  const enableResp = page.waitForResponse((r) => r.url().includes("/two-factor/enable") && r.request().method() === "POST");
  await page.getByTestId("enable-2fa").click();
  await page.getByRole("dialog").locator('input[type="password"]').fill("phila1234");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const totpURI = (await (await enableResp).json()).totpURI as string;
  const secret = new URL(totpURI).searchParams.get("secret")!;
  await expect(page.getByAltText("Two-factor QR code")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText(/two-factor enabled/i)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/2fa-enabled.png", fullPage: true });

  // Sign out, then sign in → the challenge MUST appear now.
  await context.clearCookies();
  await signIn(page, email);
  await expect(page.getByText(/authenticator code/i)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "screenshots/2fa-challenge.png", fullPage: true });
  await page.getByPlaceholder("123456").fill(totp(secret));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 30_000 });
  await expect(page).toHaveURL(/\/app/);

  // Cleanup  disable 2FA so the demo account stays simple.
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  await page.getByRole("dialog").locator('input[type="password"]').fill("phila1234");
  await page.getByRole("dialog").getByRole("button", { name: "Disable", exact: true }).click();
  await expect(page.getByText(/two-factor disabled/i)).toBeVisible({ timeout: 15_000 });
});
