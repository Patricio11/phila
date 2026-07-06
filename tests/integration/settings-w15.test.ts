import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.5  org/platform settings persist to the DB (stop discarding saves). Booking
 * policy composes from the org row + live services/counsellors and round-trips
 * through the save; the national VAT rate lives in platform_settings.
 */
const envFile = readFileSync(".env.local", "utf8");
const DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL = DATABASE_URL;
// Booking-settings writes run via runForOrg (phila_app); give it its connection.
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

import { getBookingSettingsDb, saveBookingSettingsDb } from "@/db/queries/booking-settings";
import { getPlatformSettingsDb, savePlatformVatDb } from "@/db/queries/settings";

const ORG = "org_masizakhe";

// Snapshot + restore the two mutated cells so the shared demo DB is left intact.
let originalBooking: string;
let originalVat: number;

afterAll(async () => {
  if (originalBooking !== undefined) {
    await sql`UPDATE orgs SET booking_settings = ${originalBooking}::jsonb WHERE id=${ORG}`;
  }
  if (originalVat !== undefined) {
    await sql`UPDATE platform_settings SET vat_rate_percent = ${originalVat} WHERE id='global'`;
  }
});

describe("booking settings", () => {
  it("composes from the org row + live services/counsellors, and the save round-trips", async () => {
    const [row] = await sql`SELECT booking_settings::text AS bs FROM orgs WHERE id=${ORG}`;
    originalBooking = row.bs;

    const before = await getBookingSettingsDb(ORG);
    // Seeded overrides are reflected (trauma isn't publicly bookable; couples is in-person only).
    const trauma = before.services.find((s) => s.serviceId === "svc_trauma");
    expect(trauma?.publiclyBookable).toBe(false);
    const couples = before.services.find((s) => s.serviceId === "svc_couples");
    expect(couples?.online).toBe(false);

    // Flip a couple of policy knobs and persist.
    const next = {
      ...before,
      minNoticeHours: 24,
      requireDeposit: true,
      depositCents: 15000,
      services: before.services.map((s) => (s.serviceId === "svc_trauma" ? { ...s, publiclyBookable: true } : s)),
    };
    await saveBookingSettingsDb(ORG, next);

    const after = await getBookingSettingsDb(ORG);
    expect(after.minNoticeHours).toBe(24);
    expect(after.requireDeposit).toBe(true);
    expect(after.depositCents).toBe(15000);
    expect(after.services.find((s) => s.serviceId === "svc_trauma")?.publiclyBookable).toBe(true);
    // Untouched knob survived the round-trip.
    expect(after.services.find((s) => s.serviceId === "svc_couples")?.online).toBe(false);
  });
});

describe("platform VAT", () => {
  it("reads the seeded rate and persists a super-admin change", async () => {
    const before = await getPlatformSettingsDb();
    originalVat = before.vatRatePercent;
    expect(before.vatRatePercent).toBeGreaterThanOrEqual(0);

    await savePlatformVatDb(14);
    const after = await getPlatformSettingsDb();
    expect(after.vatRatePercent).toBe(14);
  });
});
