import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 18.7  client onboarding, DB-backed and org-controlled.
 * Covers: create with phone-or-email, the opt-in "Send portal invite" switch,
 * phone-or-email validation, full edit, the invite modal (channel + copy link),
 * remove→restore, and reassign  each asserted against Postgres, not just the UI.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email = "thandeka@masizakhe.org.za", password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/hub", { timeout: 30_000 });
}

const dialog = (page: Page) => page.getByRole("dialog");

async function fillAdd(page: Page, opts: { name: string; phone?: string; email?: string; notify?: boolean }) {
  await page.getByRole("button", { name: "Add client", exact: true }).first().click();
  await expect(dialog(page).filter({ hasText: "Add a client" })).toBeVisible();
  await page.getByPlaceholder("e.g. Thandiwe Nkosi").fill(opts.name);
  if (opts.phone) await page.getByPlaceholder("082 123 4567").fill(opts.phone);
  if (opts.email) await page.getByPlaceholder("optional").fill(opts.email);
  if (opts.notify) await page.getByText("Send a portal invite").click();
}
async function submitAdd(page: Page) {
  await dialog(page).getByRole("button", { name: "Add client", exact: true }).click();
}
const cleanupByName = (name: string) =>
  sql`DELETE FROM audit_log WHERE target LIKE 'client:%' AND target IN (SELECT 'client:' || id || '/portal_invite' FROM clients WHERE name = ${name})`
    .then(() => sql`DELETE FROM clients WHERE name = ${name}`);

test("create a phone-only client persists (no invite when the switch is off)", async ({ page }) => {
  const name = `E2E PhoneOnly ${Date.now()}`;
  await signIn(page);
  await page.goto("/hub/clients");
  await page.waitForSelector("table");
  try {
    await fillAdd(page, { name, phone: "0821234567" }); // no email, notify OFF
    await submitAdd(page);
    await expect(dialog(page).filter({ hasText: "Add a client" })).toBeHidden();

    const rows = await sql`SELECT id, phone, email, primary_counsellor_id FROM clients WHERE name = ${name}`;
    expect(rows.length).toBe(1);
    expect(rows[0]!.phone).toBe("0821234567");
    expect(rows[0]!.email).toBeNull();

    // No portal invite audit — the client was added quietly.
    const invites = await sql`SELECT 1 FROM audit_log WHERE target = ${"client:" + rows[0]!.id + "/portal_invite"}`;
    expect(invites.length).toBe(0);
    await page.screenshot({ path: "screenshots/onb-create-phone-only.png", fullPage: true });
  } finally {
    await cleanupByName(name);
  }
});

test("create with email + Send invite records an email invite", async ({ page }) => {
  const stamp = Date.now();
  const name = `E2E Notify ${stamp}`;
  await signIn(page);
  await page.goto("/hub/clients");
  await page.waitForSelector("table");
  try {
    await fillAdd(page, { name, email: `e2e${stamp}@example.co.za`, notify: true });
    await submitAdd(page);
    await expect(dialog(page).filter({ hasText: "Add a client" })).toBeHidden();

    const rows = await sql`SELECT id, email FROM clients WHERE name = ${name}`;
    expect(rows.length).toBe(1);
    const invites = await sql`SELECT reason FROM audit_log WHERE target = ${"client:" + rows[0]!.id + "/portal_invite"}`;
    expect(invites.length).toBe(1);
    expect(invites[0]!.reason).toBe("invite_email");
  } finally {
    await cleanupByName(name);
  }
});

test("a client needs a phone OR an email", async ({ page }) => {
  await signIn(page);
  await page.goto("/hub/clients");
  await page.waitForSelector("table");
  await fillAdd(page, { name: "E2E No Contact" }); // neither phone nor email
  await submitAdd(page);
  // Blocked: the modal stays open with the combined contact error.
  await expect(dialog(page).filter({ hasText: "Add a client" })).toBeVisible();
  await expect(page.getByText("Add a phone number or an email").first()).toBeVisible();
});

test("full edit of a client's profile persists", async ({ page }) => {
  const stamp = Date.now();
  const id = `cl_e2e_edit_${stamp}`;
  const name = `E2E Edit ${stamp}`;
  const newName = `E2E Edited ${stamp}`;
  await sql`INSERT INTO clients (id, org_id, name, phone, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${id}, 'org_masizakhe', ${name}, '0821110000', 'Gauteng', 'couns_nomsa', false, now())`;
  try {
    await signIn(page);
    await page.goto(`/hub/clients/${id}`);
    await page.getByRole("button", { name: /Edit profile/i }).click();
    await expect(dialog(page).filter({ hasText: "Edit" })).toBeVisible();
    const nameField = page.getByPlaceholder("e.g. Thandiwe Nkosi");
    await nameField.fill(newName);
    await dialog(page).getByRole("button", { name: /Save changes/i }).click();
    await expect(dialog(page).filter({ hasText: "Edit" })).toBeHidden();

    const rows = await sql`SELECT name FROM clients WHERE id = ${id}`;
    expect(rows[0]!.name).toBe(newName);
  } finally {
    await sql`DELETE FROM clients WHERE id = ${id}`;
  }
});

test("invite modal defaults to email and offers a copy-paste link", async ({ page }) => {
  const stamp = Date.now();
  const id = `cl_e2e_inv_${stamp}`;
  const name = `E2E Invite ${stamp}`;
  await sql`INSERT INTO clients (id, org_id, name, email, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${id}, 'org_masizakhe', ${name}, 'e2e.invite@example.co.za', 'Gauteng', 'couns_nomsa', false, now())`;
  try {
    await signIn(page);
    await page.goto(`/hub/clients/${id}`);
    await page.getByRole("button", { name: /Invite to portal/i }).click();
    await expect(page.getByText(/Can't tap the link/i)).toBeVisible();
    const link = page.locator("code", { hasText: "/activate?role=client" });
    await expect(link).toBeVisible();
    // Email is the offered channel (client has an email; WhatsApp/SMS aren't connected).
    await expect(dialog(page).getByRole("button", { name: /Email e2e\.invite@example\.co\.za/ })).toBeVisible();
    await page.screenshot({ path: "screenshots/onb-invite-modal.png", fullPage: true });
  } finally {
    await sql`DELETE FROM clients WHERE id = ${id}`;
  }
});

test("remove then restore round-trips through the DB (soft delete)", async ({ page }) => {
  const stamp = Date.now();
  const id = `cl_e2e_rm_${stamp}`;
  const name = `E2E Remove ${stamp}`;
  await sql`INSERT INTO clients (id, org_id, name, phone, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${id}, 'org_masizakhe', ${name}, '0821112222', 'Gauteng', 'couns_nomsa', false, now())`;
  try {
    await signIn(page);
    await page.goto("/hub/clients");
    await page.waitForSelector("table");
    await page.getByPlaceholder(/Search clients/i).fill(name);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await row.getByRole("button", { name: "Remove", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Remove", exact: true }).click();
    await expect.poll(async () => (await sql`SELECT deleted_at FROM clients WHERE id = ${id}`)[0]!.deleted_at).not.toBeNull();

    // Restore from the Removed tab.
    await page.getByRole("button", { name: /^Removed/ }).click();
    await page.getByPlaceholder(/Search clients/i).fill(name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: /Restore/i }).click();
    await expect.poll(async () => (await sql`SELECT deleted_at FROM clients WHERE id = ${id}`)[0]!.deleted_at).toBeNull();
  } finally {
    await sql`DELETE FROM clients WHERE id = ${id}`;
  }
});

test("reassign moves a client to another counsellor in the DB", async ({ page }) => {
  const stamp = Date.now();
  const id = `cl_e2e_ra_${stamp}`;
  const name = `E2E Reassign ${stamp}`;
  const [target] = await sql`SELECT id, name FROM counsellors WHERE org_id = 'org_masizakhe' AND id <> 'couns_nomsa' LIMIT 1`;
  await sql`INSERT INTO clients (id, org_id, name, phone, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${id}, 'org_masizakhe', ${name}, '0821113333', 'Gauteng', 'couns_nomsa', false, now())`;
  try {
    await signIn(page);
    await page.goto("/hub/clients");
    await page.waitForSelector("table");
    await page.getByPlaceholder(/Search clients/i).fill(name);
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Reassign", exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    await page.getByPlaceholder(/Search counsellors/i).fill(target!.name as string);
    await page.getByRole("button", { name: new RegExp(target!.name as string) }).first().click();
    await dialog(page).getByRole("button", { name: "Reassign", exact: true }).click();
    await expect.poll(async () => (await sql`SELECT primary_counsellor_id FROM clients WHERE id = ${id}`)[0]!.primary_counsellor_id).toBe(target!.id);
  } finally {
    await sql`DELETE FROM clients WHERE id = ${id}`;
  }
});
