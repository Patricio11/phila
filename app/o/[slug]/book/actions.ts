"use server";

import { z } from "zod";
import { getDataProvider } from "@/lib/data-provider";
import { availableSlots, type Slot } from "@/lib/domain/helpers";
import { logAccess } from "@/lib/audit";
import { CONSENT_PURPOSES } from "@/lib/domain/enums";
import { now as clockNow } from "@/lib/clock";

/** SAST calendar-day string for an instant (fixed +02:00, no DST). */
function sastToday(nowISO: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowISO));
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Booking server actions  the same shape Part B keeps. In Part A they run the
 * real `availableSlots` engine over mock data and validate every input with Zod;
 * Phase 11 swaps the data source behind the seam with no caller change. Required
 * consents are enforced server-side, not just in the UI (defence in depth).
 */

export interface SlotOption {
  start: string;
  label: string;
  counsellorId: string;
}

const slotsInput = z.object({
  slug: z.string().min(1),
  counsellorId: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMin: z.number().int().positive().max(600),
});

export async function getAvailableSlots(
  raw: z.infer<typeof slotsInput>,
): Promise<{ ok: true; slots: SlotOption[] } | { ok: false; error: string }> {
  const parsed = slotsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { slug, counsellorId, date, durationMin } = parsed.data;

  const provider = await getDataProvider();
  const config = await provider.getBookingConfig(slug);
  if (!config) return { ok: false, error: "Organisation not found" };

  const { org } = config;
  const candidates = counsellorId
    ? config.counsellors.filter((c) => c.id === counsellorId)
    : config.counsellors;
  if (candidates.length === 0) return { ok: false, error: "No counsellor available" };

  // Enforce the org's booking window server-side: nothing in the past, and
  // nothing past the horizon, regardless of what the client UI requests.
  const now = clockNow();
  const today = sastToday(now);
  const latest = addDays(today, config.maxDaysAhead);
  if (date < today || date > latest) return { ok: true, slots: [] };

  // Compute each candidate's free slots, then union by start time. For "any
  // available" the first free counsellor at a given time is assigned. The slot
  // engine drops any start sooner than the org's minimum notice.
  const byStart = new Map<string, SlotOption>();
  for (const c of candidates) {
    const existing = await provider.listAppointmentsForCounsellor(c.id, { from: date, to: date });
    const slots: Slot[] = availableSlots({ org, date, durationMin, existing, now, minNoticeHours: config.minNoticeHours });
    for (const s of slots) {
      if (!byStart.has(s.start)) {
        byStart.set(s.start, { start: s.start, label: s.label, counsellorId: c.id });
      }
    }
  }

  const slots = [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
  return { ok: true, slots };
}

const submitInput = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  counsellorId: z.string().min(1),
  startsAt: z.string().min(1),
  intake: z.record(z.string(), z.string()),
  consents: z.record(z.enum(CONSENT_PURPOSES), z.boolean()),
});

export interface BookingConfirmation {
  reference: string;
  serviceName: string;
  counsellorName: string;
  startsAt: string;
  durationMin: number;
}

export async function submitBooking(
  raw: z.infer<typeof submitInput>,
): Promise<{ ok: true; confirmation: BookingConfirmation } | { ok: false; error: string }> {
  const parsed = submitInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some details are missing  please review." };
  const input = parsed.data;

  // Consent is the lawful basis: booking + notes must be granted (Consent-Before-Capture).
  if (!input.consents.booking || !input.consents.notes) {
    return { ok: false, error: "Booking and clinical-notes consent are needed to confirm." };
  }
  // Minimal contact + reason must be present.
  for (const required of ["full_name", "phone", "reason", "preferred_contact"]) {
    if (!input.intake[required]?.trim()) {
      return { ok: false, error: "Please complete the required intake fields." };
    }
  }

  const provider = await getDataProvider();
  const config = await provider.getBookingConfig(input.slug);
  if (!config) return { ok: false, error: "Organisation not found" };

  const service = config.services.find((s) => s.id === input.serviceId);
  const counsellor = config.counsellors.find((c) => c.id === input.counsellorId);
  if (!service || !counsellor) return { ok: false, error: "That service is no longer available." };

  // Record the consent grants and the (mock) booking  every PII capture audited.
  for (const purpose of CONSENT_PURPOSES) {
    if (input.consents[purpose]) {
      await logAccess({
        action: "consent.change",
        actor: { userId: "public:booking", platformRole: "client", teamRole: null },
        orgId: config.org.id,
        target: `consent:${purpose}`,
        reason: "booking_grant",
      });
    }
  }
  await logAccess({
    action: "pii.read",
    actor: { userId: "public:booking", platformRole: "client", teamRole: null },
    orgId: config.org.id,
    target: `booking:${service.id}`,
    reason: "intake_capture",
  });

  // Part A: no persistence  return an honest confirmation. Phase 9/10 persists
  // the client account, appointment, intake, and consent records.
  const reference = `PH-${shortRef()}`;
  return {
    ok: true,
    confirmation: {
      reference,
      serviceName: service.name,
      counsellorName: counsellor.name,
      startsAt: input.startsAt,
      durationMin: service.durationMin,
    },
  };
}

function shortRef(): string {
  // Server-side only; randomness here is fine (not a React render).
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
