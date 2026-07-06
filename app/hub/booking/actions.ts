"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveBookingSettingsDb } from "@/db/queries/booking-settings";

/**
 * Public-booking settings (mock). The Hub shapes its own /o/[slug]/book here.
 * Validated + audited; `getBookingConfig` already enforces visibility (which
 * services + counsellors the public sees, and the master switch). The slot
 * engine (Phase 11) enforces notice / horizon; payments (Phase 13) the deposit.
 */
const servicePolicy = z.object({
  serviceId: z.string().min(1),
  publiclyBookable: z.boolean(),
  inPerson: z.boolean(),
  online: z.boolean(),
});

const counsellorPolicy = z.object({
  counsellorId: z.string().min(1),
  publiclyBookable: z.boolean(),
});

const input = z.object({
  publicBookingEnabled: z.boolean(),
  minNoticeHours: z.number().int().min(0).max(336),
  maxDaysAhead: z.number().int().min(1).max(365),
  requireIntake: z.boolean(),
  requireDeposit: z.boolean(),
  depositCents: z.number().int().min(0).max(10_000_00),
  services: z.array(servicePolicy),
  counsellors: z.array(counsellorPolicy),
});

export async function saveBookingSettings(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the settings." };
  const s = parsed.data;

  // Coherence: a bookable service must offer at least one way to attend.
  for (const svc of s.services) {
    if (svc.publiclyBookable && !svc.inPerson && !svc.online) {
      return { ok: false, error: "Each bookable service needs in-person, online, or both." };
    }
  }
  if (s.publicBookingEnabled && !s.services.some((svc) => svc.publiclyBookable)) {
    return { ok: false, error: "Turn on at least one service, or switch public booking off." };
  }
  if (s.publicBookingEnabled && !s.counsellors.some((c) => c.publiclyBookable)) {
    return { ok: false, error: "List at least one counsellor for public booking." };
  }
  if (s.requireDeposit && s.depositCents <= 0) {
    return { ok: false, error: "Set a deposit amount, or turn the deposit off." };
  }

  if (process.env.DATA_PROVIDER === "db") {
    await saveBookingSettingsDb(membership.orgId, { orgId: membership.orgId, ...s });
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/booking_settings`,
    reason: "update_booking_settings",
  });
  revalidatePath("/hub/booking");
  return { ok: true };
}
