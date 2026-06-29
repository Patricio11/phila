import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 11 — room utilisation reads REAL appointments. A booking inserted into a
 * room this week shows on the Hub room detail (getRoomDetail reads the DB, not mock).
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

test("Hub room detail reflects a live booking in that room", async ({ page }) => {
  const stamp = Date.now();
  const cid = `cl_room_${stamp}`;
  const aid = `appt_room_${stamp}`;
  const name = `RoomProbe ${stamp}`;
  await sql`INSERT INTO clients (id, org_id, name, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${cid}, 'org_masizakhe', ${name}, 'Gauteng', 'couns_nomsa', false, now())`;
  // 06:00 is outside seeded business-hours bookings, so it won't clash with the constraint.
  await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, room_id, starts_at, duration_min, state, tags)
    VALUES (${aid}, 'org_masizakhe', ${cid}, 'couns_nomsa', 'svc_individual', 'in_person', 'room_s1', ${`${sastToday()}T06:00:00+02:00`}, 30, 'scheduled', '[]'::jsonb)`;
  try {
    await signIn(page, "thandeka@masizakhe.org.za");
    await page.waitForURL("**/hub", { timeout: 30_000 });
    await page.goto("/hub/rooms/room_s1");
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "screenshots/room-detail-db.png", fullPage: true });
  } finally {
    await sql`DELETE FROM appointments WHERE id = ${aid}`;
    await sql`DELETE FROM clients WHERE id = ${cid}`;
  }
});
