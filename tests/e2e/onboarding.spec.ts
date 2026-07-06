import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.8b/c  the company-verification gate (org side) + the admin review. Screenshots
 * the hub banner, the verification page (company form + document checklist), the
 * admin orgs list (verification stage), and the admin review with approve/send-back.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const UBUNTU_ADMIN = "staff1@ubuntu-community-care.example"; // seeded org_admin, email-verified, not_started

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("org sees the verification gate and can complete its company profile", async ({ page }) => {
  await sql`UPDATE orgs SET onboarding_status='not_started', profile='{}'::jsonb WHERE id='org_ubuntu'`;
  await signIn(page, UBUNTU_ADMIN);
  await page.waitForURL((u) => /\/hub|\/welcome/.test(u.pathname), { timeout: 30_000 });
  await page.goto("/hub");

  // The go-live gate banner is visible.
  await expect(page.getByText("Complete your company profile to go fully live")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/hub-verification-banner.png", fullPage: true });

  // The verification page: company form + document checklist.
  await page.goto("/hub/verification");
  await expect(page.getByText("Company information")).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder("As registered with CIPC / DSD").fill("Ubuntu Community Care NPC");
  await page.getByPlaceholder("e.g. 2019/123456/07").fill("2018/402913/08");
  await page.getByPlaceholder("Full name").fill("Nomsa Khumalo");
  await page.getByPlaceholder("officer@practice.co.za").fill("popia@ubuntu.example");
  await page.getByPlaceholder("Street, suburb, city, code").fill("14 Florida Road, Durban, 4001");
  await page.screenshot({ path: "screenshots/hub-verification-page.png", fullPage: true });

  await page.getByRole("button", { name: "Save company profile" }).click();
  await expect(page.getByText("Company profile saved")).toBeVisible({ timeout: 10_000 });
});

test("super-admin sees verification stages and can review a submitted practice", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await page.waitForURL("**/admin", { timeout: 30_000 });

  // Orgs list shows the verification-stage column.
  await page.goto("/admin/orgs");
  await expect(page.getByText("Thrive EAP")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Submitted").first()).toBeVisible();
  await page.screenshot({ path: "screenshots/admin-orgs-verification.png", fullPage: true });

  // Ubuntu's detail now shows the company info we just captured + the review panel.
  await page.goto("/admin/orgs/org_ubuntu");
  await expect(page.getByText("Company information")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Ubuntu Community Care NPC")).toBeVisible();
  await page.screenshot({ path: "screenshots/admin-org-review.png", fullPage: true });

  // A submitted org shows the approve / send-back controls.
  await page.goto("/admin/orgs/org_thrive");
  await expect(page.getByRole("button", { name: /Approve & verify/ })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/admin-org-approve.png", fullPage: true });
});
