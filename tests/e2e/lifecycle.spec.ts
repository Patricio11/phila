import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 10 — appointment lifecycle persists. Marking a session on the calendar
 * (markProgress → setAppointmentState) writes the new state to Postgres.
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

test("marking a session completed persists the state to the DB", async ({ page }) => {
  const id = `appt_e2e_${Date.now()}`;
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
    VALUES (${id}, 'org_masizakhe', 'cl_megan', 'couns_nomsa', 'svc_individual', 'in_person', 'room_s1', ${`${sastToday()}T11:00:00+02:00`}, 60, 'scheduled', '[]'::jsonb)`;
  try {
    await signIn(page, "nomsa@masizakhe.org.za");
    await page.waitForURL("**/app", { timeout: 30_000 });
    await page.goto("/app/appointments");
    await page.getByText("Megan Pillay").first().click(); // opens the appointment detail
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByText(/Marked completed/i)).toBeVisible({ timeout: 15_000 });

    const [row] = await sql`SELECT state FROM appointments WHERE id = ${id}`;
    expect(row!.state).toBe("completed");
  } finally {
    await sql`DELETE FROM appointments WHERE id = ${id}`;
  }
});
