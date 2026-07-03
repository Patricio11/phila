import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 18.8  Funders & grants made fully functional + org-gated. The org enables
 * the module, builds a funder + grant with a target, tags clients, and invites a
 * funder to a read-only scope  each asserted against Postgres.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);
const ORG = "org_masizakhe";

async function signIn(page: Page, email = "thandeka@masizakhe.org.za", password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/hub", { timeout: 30_000 });
}
const setFunders = (on: boolean) => sql`UPDATE orgs SET features = features || ${JSON.stringify({ funders: on })}::jsonb WHERE id = ${ORG}`;
const dialog = (page: Page) => page.getByRole("dialog");

test("the Funders & grants module is off until the org enables it", async ({ page }) => {
  await setFunders(false);
  try {
    await signIn(page);
    // Hidden: the nav item is gone and the page redirects home.
    await expect(page.getByRole("link", { name: "Funders & grants" })).toHaveCount(0);
    await page.goto("/hub/funders");
    await expect(page).toHaveURL(/\/hub$/);

    // Enable it in Settings → Integrations.
    await page.goto("/hub/settings");
    await page.getByRole("tab", { name: /Integrations/ }).click();
    await page.getByText("Funders & grants (M&E)").scrollIntoViewIfNeeded();
    await page.getByRole("switch", { name: /Turn on Funders and grants/i }).click();
    await expect.poll(async () => (await sql`SELECT features->>'funders' f FROM orgs WHERE id = ${ORG}`)[0]!.f).toBe("true");

    // Now it's reachable.
    await page.goto("/hub/funders");
    await expect(page.getByRole("heading", { level: 2, name: "Funders & grants" })).toBeVisible();
    await page.screenshot({ path: "screenshots/funders-page.png", fullPage: true });
  } finally {
    await setFunders(true); // leave enabled for the rest of the suite/demo
  }
});

test("create a funder + grant with a target, persisted to the DB", async ({ page }) => {
  const stamp = Date.now();
  const funderName = `E2E Funder ${stamp}`;
  const grantTitle = `E2E Grant ${stamp}`;
  await setFunders(true);
  try {
    await signIn(page);
    await page.goto("/hub/funders");
    await expect(page.getByRole("heading", { level: 2, name: "Funders & grants" })).toBeVisible();

    // Add funder.
    await page.getByRole("button", { name: "Add funder", exact: true }).click();
    await expect(dialog(page).filter({ hasText: "Add a funder" })).toBeVisible();
    await page.getByPlaceholder(/Department of Social Development/).fill(funderName);
    await dialog(page).getByRole("button", { name: "Add funder", exact: true }).click();
    await expect(dialog(page).filter({ hasText: "Add a funder" })).toBeHidden();
    const funders = await sql`SELECT id FROM funders WHERE name = ${funderName} AND org_id = ${ORG}`;
    expect(funders.length).toBe(1);

    // New grant under that funder, with a "unique clients" target of 25.
    await page.getByRole("button", { name: "New grant", exact: true }).click();
    await expect(dialog(page).filter({ hasText: "New grant" })).toBeVisible();
    await page.getByPlaceholder(/Community mental-health programme/).fill(grantTitle);
    await page.locator('input[type="date"]').first().fill("2026-01-01");
    await page.locator('input[type="date"]').nth(1).fill("2026-12-31");
    await page.getByRole("button", { name: /Add target/i }).click();
    await page.locator('input[type="number"]').last().fill("25");
    await dialog(page).getByRole("button", { name: "Create grant", exact: true }).click();
    await expect(dialog(page).filter({ hasText: "New grant" })).toBeHidden();

    const grants = await sql`SELECT id FROM grants WHERE title = ${grantTitle} AND org_id = ${ORG}`;
    expect(grants.length).toBe(1);
    const inds = await sql`SELECT metric, target FROM grant_indicators WHERE grant_id = ${grants[0]!.id}`;
    expect(inds.length).toBe(1);
    expect(Number(inds[0]!.target)).toBe(25);
    await page.screenshot({ path: "screenshots/funders-grant-created.png", fullPage: true });
  } finally {
    const gs = await sql`SELECT id FROM grants WHERE title = ${grantTitle}`;
    for (const g of gs) { await sql`DELETE FROM grant_indicators WHERE grant_id = ${g.id}`; await sql`DELETE FROM grant_allocations WHERE grant_id = ${g.id}`; }
    await sql`DELETE FROM grants WHERE title = ${grantTitle}`;
    await sql`DELETE FROM funders WHERE name = ${funderName}`;
  }
});

test("tag clients to a grant + invite a funder to a scoped portal", async ({ page }) => {
  const stamp = Date.now();
  const fid = `f_e2e_${stamp}`;
  const gid = `g_e2e_${stamp}`;
  const funderName = `E2E Scoped Funder ${stamp}`;
  const grantTitle = `E2E Scoped Grant ${stamp}`;
  const email = `funder.e2e.${stamp}@example.org`;
  await setFunders(true);
  await sql`INSERT INTO funders (id, org_id, name, type, contact_name, contact_email) VALUES (${fid}, ${ORG}, ${funderName}, 'government', '', '')`;
  await sql`INSERT INTO grants (id, funder_id, org_id, title, period_start, period_end, amount_cents, restricted, reporting_schedule, status)
    VALUES (${gid}, ${fid}, ${ORG}, ${grantTitle}, '2026-01-01', '2026-12-31', 50000000, true, 'quarterly', 'active')`;
  const [client] = await sql`SELECT id, name FROM clients WHERE org_id = ${ORG} AND deleted_at IS NULL LIMIT 1`;
  try {
    await signIn(page);

    // Tag a client to the grant.
    await page.goto(`/hub/grants/${gid}`);
    await page.getByRole("button", { name: /Tag clients/i }).click();
    await expect(dialog(page)).toBeVisible();
    await page.getByPlaceholder(/Search clients/i).fill(client!.name as string);
    await page.getByRole("button", { name: new RegExp(client!.name as string) }).first().click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM grant_allocations WHERE grant_id = ${gid}`)[0]!.n).toBe(1);

    // Invite a funder scoped to this grant.
    await page.goto("/hub/funders");
    await page.getByRole("button", { name: "Invite funder", exact: true }).click();
    await expect(dialog(page).filter({ hasText: "Invite a funder" })).toBeVisible();
    // Choose the funder so its grant is offered, then scope to the grant + email.
    await dialog(page).locator('[aria-haspopup="listbox"]').first().click();
    await page.getByRole("option", { name: funderName }).click();
    await page.getByPlaceholder(/funding@example.org/).fill(email);
    await page.getByRole("button", { name: grantTitle }).click();
    await dialog(page).getByRole("button", { name: "Send invite", exact: true }).click();
    await expect(page.locator("code", { hasText: "/activate?role=funder" })).toBeVisible();

    const contacts = await sql`SELECT fc.grant_ids FROM funder_contacts fc JOIN "user" u ON u.id = fc.user_id WHERE u.email = ${email}`;
    expect(contacts.length).toBe(1);
    expect(contacts[0]!.grant_ids).toContain(gid);
    await page.screenshot({ path: "screenshots/funders-invite.png", fullPage: true });
  } finally {
    await sql`DELETE FROM funder_contacts WHERE user_id IN (SELECT id FROM "user" WHERE email = ${email})`;
    await sql`DELETE FROM "user" WHERE email = ${email}`;
    await sql`DELETE FROM grant_allocations WHERE grant_id = ${gid}`;
    await sql`DELETE FROM grants WHERE id = ${gid}`;
    await sql`DELETE FROM funders WHERE id = ${fid}`;
  }
});
