"use server";

import { z } from "zod";
import { getDataProvider } from "@/lib/data-provider";
import { availableSlots, type Slot } from "@/lib/domain/helpers";
import { logAccess } from "@/lib/audit";
import { CONSENT_PURPOSES } from "@/lib/domain/enums";
import { now as clockNow } from "@/lib/clock";
import { persistBooking } from "@/db/queries/booking";
import { createInvoiceForBookingDb } from "@/db/queries/invoices";
import { recordBookingIntakeDb } from "@/db/queries/forms";
import { recordPageEvent } from "@/db/queries/public-page";
import { isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/db/queries/errors";
import { notifyAppointmentBooked } from "@/lib/messaging/notify";
import { videoJoinPath } from "@/lib/video/livekit";

/** First active room with no overlapping booking in [start, start+duration). */
async function assignRoom(orgId: string, date: string, startsAt: string, durationMin: number): Promise<string | null> {
  const provider = await getDataProvider();
  const [rooms, dayAppts] = await Promise.all([
    provider.listRooms(orgId),
    provider.listAppointmentsForOrg(orgId, { from: date, to: date }),
  ]);
  const startMs = new Date(startsAt).getTime();
  const endMs = startMs + durationMin * 60_000;
  const overlaps = (a: { startsAt: string; durationMin: number }) => {
    const s = new Date(a.startsAt).getTime();
    return startMs < s + a.durationMin * 60_000 && endMs > s;
  };
  const busy = new Set(dayAppts.filter((a) => a.roomId && a.state !== "cancelled" && overlaps(a)).map((a) => a.roomId));
  const free = rooms.find((r) => r.status === "active" && !busy.has(r.id));
  return free?.name ?? null;
}

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
  modality: z.enum(["in_person", "online"]),
  intake: z.record(z.string(), z.string()),
  consents: z.record(z.enum(CONSENT_PURPOSES), z.boolean()),
});

export interface BookingConfirmation {
  reference: string;
  serviceName: string;
  counsellorName: string;
  startsAt: string;
  durationMin: number;
  modality: "in_person" | "online";
  /** Assigned consulting room for an in-person session (null = confirmed later). */
  roomName: string | null;
  /** Secure video link for an online session (null until the video adapter is live). */
  joinUrl: string | null;
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
  // Minimal details + reason must be present.
  for (const required of ["full_name", "reason", "preferred_contact"]) {
    if (!input.intake[required]?.trim()) {
      return { ok: false, error: "Please complete the required intake fields." };
    }
  }
  // A client is reachable with EITHER a phone number or an email (many SA clients
  // have no email)  the same phone-or-email rule the hub uses when creating clients.
  if (!input.intake.phone?.trim() && !input.intake.email?.trim()) {
    return { ok: false, error: "Add a phone number or an email so we can confirm your session." };
  }

  const provider = await getDataProvider();
  const config = await provider.getBookingConfig(input.slug);
  if (!config) return { ok: false, error: "Organisation not found" };

  const service = config.services.find((s) => s.id === input.serviceId);
  const counsellor = config.counsellors.find((c) => c.id === input.counsellorId);
  if (!service || !counsellor) return { ok: false, error: "That service is no longer available." };

  // The chosen way to attend must be one the service actually offers.
  const allowed = config.serviceModalities[service.id];
  if (input.modality === "online" && !allowed?.online) return { ok: false, error: "That service isn't offered online." };
  if (input.modality === "in_person" && !allowed?.inPerson) return { ok: false, error: "That service is offered online only." };

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

  const reference = `PH-${shortRef()}`;
  const date = input.startsAt.slice(0, 10);
  let roomName: string | null = null;
  let joinUrl: string | null = null;

  // Persist for real (db mode): auto-register the client, allocate a room, create
  // the scheduled appointment, record consent. Mock mode just resolves a room for
  // the confirmation. Online always mints a link via the video adapter (dormant
  // → null until the org turns video on).
  if (process.env.DATA_PROVIDER === "db") {
    try {
      const res = await persistBooking({
        orgId: config.org.id,
        province: config.org.province,
        serviceId: service.id,
        counsellorId: counsellor.id,
        startsAt: input.startsAt,
        durationMin: service.durationMin,
        modality: input.modality,
        intake: input.intake,
        consents: input.consents,
      });
      roomName = res.roomName;
      // Online → a real, time-bound signed join link to the LiveKit room for this appointment.
      if (input.modality === "online") joinUrl = videoJoinPath(res.appointmentId, input.startsAt);
      // Email (rail) + always-on in-app for the counsellor + client (Phase 17.2).
      await notifyAppointmentBooked(res.appointmentId);
      // Auto-raise an invoice for the session (priced services only; org-toggleable) so
      // the client can pay online. Best-effort — never break a booking over billing.
      try { await createInvoiceForBookingDb({ orgId: config.org.id, appointmentId: res.appointmentId, clientId: res.clientId, serviceName: service.name, amountCents: service.priceCents ?? 0, issuedAt: new Date(clockNow()) }); } catch { /* never break booking */ }
      void recordPageEvent(config.org.id, "booked"); // PII-free conversion (Phase 17)
      // Mirror the intake into the active intake form's Responses (best-effort).
      try { await recordBookingIntakeDb(config.org.id, res.clientId, input.intake, clockNow()); } catch { /* never break booking */ }
      // Auto-invite to the portal ONLY if the org opted in (Dormant-by-Default).
      // Otherwise the client just gets the booking confirmation  no set-password link.
      if (config.org.clientPortal.inviteOnBooking) {
        const channel = input.intake.email?.trim() ? "email" : "sms";
        await logAccess({
          action: "admin.action",
          actor: { userId: "public:booking", platformRole: "client", teamRole: null },
          orgId: config.org.id,
          target: `client:${res.clientId}/portal_invite`,
          reason: `invite_${channel}`,
        });
      }
    } catch (e) {
      if (isSlotTakenError(e)) return { ok: false, error: SLOT_TAKEN_MESSAGE };
      throw e;
    }
  } else if (input.modality === "in_person") {
    roomName = await assignRoom(config.org.id, date, input.startsAt, service.durationMin);
  }

  return {
    ok: true,
    confirmation: {
      reference,
      serviceName: service.name,
      counsellorName: counsellor.name,
      startsAt: input.startsAt,
      durationMin: service.durationMin,
      modality: input.modality,
      roomName,
      joinUrl,
    },
  };
}

function shortRef(): string {
  // Server-side only; randomness here is fine (not a React render).
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
