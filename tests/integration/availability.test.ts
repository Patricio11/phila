import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Feedback #5 - counsellor availability. ORG-managed weekly windows narrow when
 * a counsellor can be booked; no windows = they follow the practice hours; and
 * several counsellors can hold the same hour. Auto-assign picks the least-loaded.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { getCounsellorAvailabilityDb, saveCounsellorAvailabilityDb, availableCounsellorsAtDb, leastLoadedOfDb } =
  await import("@/db/queries/availability");
const { availableSlots } = await import("@/lib/domain/helpers");

const ORG = "org_avail_probe";
const HOURS: import("@/lib/domain/types").BusinessHours = { 1: { start: "08:00", end: "17:00" }, 2: { start: "08:00", end: "17:00" }, 3: { start: "08:00", end: "17:00" }, 4: { start: "08:00", end: "17:00" }, 5: { start: "08:00", end: "17:00" }, 6: null, 7: null };

/** Next Monday at least a week out - far from seeded data, always a working day. */
function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7 + ((8 - d.getDay()) % 7));
  return d.toISOString().slice(0, 10);
}
const MONDAY = nextMonday();

afterAll(async () => {
  await sql`DELETE FROM appointments WHERE org_id=${ORG}`;
  await sql`DELETE FROM clients WHERE org_id=${ORG}`;
  await sql`DELETE FROM services WHERE org_id=${ORG}`;
  await sql`DELETE FROM counsellor_availability WHERE org_id=${ORG}`;
  await sql`DELETE FROM counsellors WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("counsellor availability", () => {
  it("windows narrow bookability; no windows inherit org hours; least-loaded wins", { timeout: 40_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, created_at)
      VALUES (${ORG}, 'Availability Probe', 'avail-probe', 'Gauteng', '{}'::jsonb, ${JSON.stringify({ businessHours: HOURS, defaultDurationMin: 60, bufferMin: 0 })}::jsonb, '{}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO counsellors (id, org_id, user_id, name, credential_body, credential_status) VALUES
      ('couns_av_a', ${ORG}, 'user_av_a', 'Morning Counsellor', 'HPCSA', 'verified'),
      ('couns_av_b', ${ORG}, 'user_av_b', 'Fullday Counsellor', 'HPCSA', 'verified')
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO services (id, org_id, name, duration_min, price_cents)
      VALUES ('svc_av', ${ORG}, 'Probe counselling', 60, 40000) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO clients (id, org_id, primary_counsellor_id, name, province, created_at)
      VALUES ('cl_av_1', ${ORG}, 'couns_av_b', 'Avail Client', 'Gauteng', now()) ON CONFLICT (id) DO NOTHING`;

    // 1) Save + read back: A works Monday mornings only. B has no pattern.
    await saveCounsellorAvailabilityDb(ORG, "couns_av_a", [{ weekday: 1, start: "09:00", end: "13:00" }]);
    const rows = await getCounsellorAvailabilityDb(ORG, "couns_av_a");
    expect(rows).toEqual([{ weekday: 1, start: "09:00", end: "13:00" }]);

    // 2) Monday 10:00 fits both; Monday 14:00 only B (A's window ended).
    const at10 = await availableCounsellorsAtDb(ORG, `${MONDAY}T10:00:00+02:00`, 60, HOURS);
    expect(at10.available.sort()).toEqual(["couns_av_a", "couns_av_b"]);
    const at14 = await availableCounsellorsAtDb(ORG, `${MONDAY}T14:00:00+02:00`, 60, HOURS);
    expect(at14.available).toEqual(["couns_av_b"]);
    // 12:30 start would spill past A's 13:00 end - only B.
    const at1230 = await availableCounsellorsAtDb(ORG, `${MONDAY}T12:30:00+02:00`, 60, HOURS);
    expect(at1230.available).toEqual(["couns_av_b"]);

    // 3) Same-hour sharing: book B at 10:00 - the hour stays open via A.
    await sql`INSERT INTO appointments (id, org_id, client_id, counsellor_id, service_id, type, starts_at, duration_min, state)
      VALUES ('appt_av_b10', ${ORG}, 'cl_av_1', 'couns_av_b', 'svc_av', 'online', ${`${MONDAY}T10:00:00+02:00`}, 60, 'scheduled') ON CONFLICT (id) DO NOTHING`;
    const at10b = await availableCounsellorsAtDb(ORG, `${MONDAY}T10:00:00+02:00`, 60, HOURS);
    expect(at10b.available).toEqual(["couns_av_a"]);

    // 4) Least-loaded: B carries 1 session that Monday, A none → A gets the next booking.
    expect(await leastLoadedOfDb(ORG, ["couns_av_a", "couns_av_b"], MONDAY)).toBe("couns_av_a");

    // 5) The slot engine honours windows: A's Monday slots stay inside 09:00–13:00.
    const org = { scheduling: { businessHours: HOURS, defaultDurationMin: 60, bufferMin: 0 } };
    const slots = availableSlots({
      org: org as never, date: MONDAY, durationMin: 60, existing: [],
      now: `${MONDAY}T00:00:00+02:00`, minNoticeHours: 0, slotIntervalMin: 60,
      windows: [{ start: "09:00", end: "13:00" }],
    });
    const labels = slots.map((s) => s.label);
    expect(labels[0]).toBe("09:00");
    expect(labels.at(-1)).toBe("12:00");
    // And an empty windows list = not working that day at all.
    const off = availableSlots({
      org: org as never, date: MONDAY, durationMin: 60, existing: [],
      now: `${MONDAY}T00:00:00+02:00`, minNoticeHours: 0, slotIntervalMin: 60, windows: [],
    });
    expect(off).toEqual([]);
  });
});
