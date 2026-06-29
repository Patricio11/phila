import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — appointments are DB-backed. We insert an appointment for Nomsa that
 * references a client who is NOT on her seeded schedule (Megan, Pieter's client).
 * If it appears on Nomsa's calendar it can only have come from the DB (the mock
 * materialiser would never produce it). Cleans up after itself.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

function sastToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("counsellor calendar renders an appointment written to the DB", async ({ page }) => {
  const id = `appt_e2e_${Date.now()}`;
  const startsAt = `${sastToday()}T12:00:00+02:00`; // midday gap — free for Nomsa + room_s1 (no overlap)
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
    VALUES (${id}, 'org_masizakhe', 'cl_megan', 'couns_nomsa', 'svc_individual', 'in_person', 'room_s1', ${startsAt}, 60, 'scheduled', '[]'::jsonb)`;
  try {
    await signIn(page, "nomsa@masizakhe.org.za");
    await page.waitForURL("**/app", { timeout: 30_000 });
    await page.goto("/app/appointments");
    // Megan is not on Nomsa's seeded schedule — seeing her proves the DB read.
    await expect(page.getByText("Megan Pillay").first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/appointments-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM appointments WHERE id = ${id}`;
  }
});
