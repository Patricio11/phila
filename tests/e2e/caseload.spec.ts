import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — listCaseload reads the DB. A client + completed session inserted
 * straight into Postgres (not in the fixtures) shows up on the counsellor's
 * caseload, proving the read is real (not mock-fallback).
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("counsellor caseload reflects a live DB client + session", async ({ page }) => {
  const stamp = Date.now();
  const cid = `cl_case_${stamp}`;
  const aid = `appt_case_${stamp}`;
  const name = `Caseload Probe ${stamp}`;
  await sql`INSERT INTO clients (id, org_id, name, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${cid}, 'org_masizakhe', ${name}, 'Gauteng', 'couns_nomsa', false, now())`;
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
    VALUES (${aid}, 'org_masizakhe', ${cid}, 'couns_nomsa', 'svc_individual', 'in_person', 'room_s1', '2026-06-20T10:00:00+02:00', 60, 'completed', '[]'::jsonb)`;
  try {
    await signIn(page, "nomsa@masizakhe.org.za");
    await page.waitForURL("**/app", { timeout: 30_000 });
    await page.goto("/app/clients");
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/caseload-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM appointments WHERE id = ${aid}`;
    await sql`DELETE FROM clients WHERE id = ${cid}`;
  }
});
