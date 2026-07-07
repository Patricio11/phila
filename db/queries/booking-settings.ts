import "server-only";
import { eq } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { orgs, services as servicesTable, counsellors as counsellorsTable } from "@/db/schema";
import type { BookingSettings } from "@/lib/data-provider";

/**
 * Public-booking policy (W1.5). Stored as one JSONB blob on the org
 * (`orgs.booking_settings`)  the org-level switches plus per-service and
 * per-counsellor override maps  then composed against the live services/
 * counsellors so a newly-added service inherits sensible defaults (bookable,
 * online only if the org runs video; a counsellor bookable once verified).
 * RLS-scoped via runForOrg.
 */
interface SeedShape {
  publicBookingEnabled?: boolean;
  minNoticeHours?: number;
  maxDaysAhead?: number;
  requireIntake?: boolean;
  requireDeposit?: boolean;
  depositCents?: number;
  services?: Record<string, { publiclyBookable: boolean; inPerson: boolean; online: boolean }>;
  counsellors?: Record<string, { publiclyBookable: boolean }>;
}

export async function getBookingSettingsDb(orgId: string): Promise<BookingSettings> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [orgRows, svcRows, cnsRows] = await Promise.all([
      db.select({ features: orgs.features, booking: orgs.bookingSettings }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
      db.select({ id: servicesTable.id }).from(servicesTable).where(eq(servicesTable.orgId, orgId)),
      db.select({ id: counsellorsTable.id, status: counsellorsTable.credentialStatus }).from(counsellorsTable).where(eq(counsellorsTable.orgId, orgId)),
    ]);
    const seed = (orgRows[0]?.booking as SeedShape) ?? {};
    const videoOn = Boolean((orgRows[0]?.features as Record<string, boolean> | undefined)?.video);
    return {
      orgId,
      publicBookingEnabled: seed.publicBookingEnabled ?? true,
      minNoticeHours: seed.minNoticeHours ?? 12,
      maxDaysAhead: seed.maxDaysAhead ?? 60,
      requireIntake: seed.requireIntake ?? true,
      requireDeposit: seed.requireDeposit ?? false,
      depositCents: seed.depositCents ?? 0,
      services: svcRows.map((s) => {
        const o = seed.services?.[s.id];
        return { serviceId: s.id, publiclyBookable: o?.publiclyBookable ?? true, inPerson: o?.inPerson ?? true, online: o?.online ?? videoOn };
      }),
      counsellors: cnsRows.map((c) => {
        const o = seed.counsellors?.[c.id];
        return { counsellorId: c.id, publiclyBookable: o?.publiclyBookable ?? c.status === "verified" };
      }),
    };
  });
}

export async function saveBookingSettingsDb(orgId: string, input: BookingSettings): Promise<void> {
  await runForOrg(orgId, () => {
    const seed: SeedShape = {
      publicBookingEnabled: input.publicBookingEnabled,
      minNoticeHours: input.minNoticeHours,
      maxDaysAhead: input.maxDaysAhead,
      requireIntake: input.requireIntake,
      requireDeposit: input.requireDeposit,
      depositCents: input.depositCents,
      services: Object.fromEntries(input.services.map((s) => [s.serviceId, { publiclyBookable: s.publiclyBookable, inPerson: s.inPerson, online: s.online }])),
      counsellors: Object.fromEntries(input.counsellors.map((c) => [c.counsellorId, { publiclyBookable: c.publiclyBookable }])),
    };
    return activeDb().update(orgs).set({ bookingSettings: seed as Record<string, unknown> }).where(eq(orgs.id, orgId));
  });
}
