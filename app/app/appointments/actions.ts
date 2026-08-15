"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { logAccess } from "@/lib/audit";
import { requireOrg } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import { appointments } from "@/db/schema";
import { rescheduleAppointment as persistReschedule, cancelAppointment as persistCancel } from "@/db/queries/appointments";
import { markNoShowFollowedUpDb } from "@/db/queries/no-shows";
import { isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/db/queries/errors";
import { notifyAppointment, offerFreedSlot } from "@/lib/messaging/notify";
import { videoJoinPath } from "@/lib/video/livekit";
import { APPOINTMENT_TYPES, needsRoom } from "@/lib/domain/enums";
import { availableSlots, isoWeekday } from "@/lib/domain/helpers";
import { getDataProvider } from "@/lib/data-provider";
import { now as clockNow } from "@/lib/clock";

/** A signed, in-org join link for an online session (Phase 17.2). */
export async function getAppointmentJoinLink(
  raw: { appointmentId: string },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { membership } = await requireOrg([...SCHEDULERS]);
  const parsed = z.object({ appointmentId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [appt] = await getDb().select({ orgId: appointments.orgId, type: appointments.type, startsAt: appointments.startsAt }).from(appointments).where(eq(appointments.id, parsed.data.appointmentId)).limit(1);
  if (!appt || appt.orgId !== membership.orgId) return { ok: false, error: "Session not found." };
  if (appt.type !== "online") return { ok: false, error: "This session isn't online." };
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return { ok: true, url: `${base}${videoJoinPath(parsed.data.appointmentId, appt.startsAt.toISOString())}` };
}

const scope = z.enum(["this", "following"]).default("this");

/** Who may move/cancel a session: the counsellor, the org admin, or reception. */
const SCHEDULERS = ["counsellor", "org_admin", "front_desk"] as const;

/**
 * Reschedule. Moves the session (or, for a recurring series with
 * `scope: "following"`, this + every later session by the same delta). The DB
 * exclusion constraints reject a move that would double-book the counsellor or
 * room (race-free). Audited. No notification fires yet (messaging is Phase 12).
 */
const rescheduleInput = z.object({
  appointmentId: z.string().min(1),
  newStart: z.string().min(1),
  scope,
  /** Optional reason  kept on the session record. */
  note: z.string().trim().max(500).optional(),
});

/** SAST calendar date + wall-clock minute for an instant. */
function sastParts(iso: string): { date: string; hhmm: string } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
  return { date: s.slice(0, 10), hhmm: s.slice(-5) };
}

/**
 * Batch 3s - the REAL open times for moving one session: the org's hours for
 * that day intersected with the counsellor's windows for this session's type,
 * minus their other bookings (the session being moved doesn't block itself).
 * One computation serves the reschedule panel AND the server-side guard, so
 * what the UI offers and what the server accepts can never drift apart.
 */
async function computeRescheduleSlots(
  orgId: string,
  appointmentId: string,
  date: string,
): Promise<{ ok: true; slots: { start: string; label: string }[] } | { ok: false; error: string }> {
  const [appt] = await getDb().select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt || appt.orgId !== orgId) return { ok: false, error: "Session not found." };

  const provider = await getDataProvider();
  const org = await provider.getOrg(orgId);
  if (!org) return { ok: false, error: "Practice not found." };

  const existingAll = await provider.listAppointmentsForCounsellor(appt.counsellorId, { from: date, to: date });
  const existing = existingAll.filter((a) => a.id !== appt.id);

  const { getOrgAvailabilityMapDb, windowsForType } = await import("@/db/queries/availability");
  const availability = await getOrgAvailabilityMapDb(orgId);
  const pattern = availability.get(appt.counsellorId);
  const modality = appt.type === "online" ? ("online" as const) : ("in_person" as const);
  const wd = isoWeekday(date);
  const windows = pattern === undefined ? undefined : windowsForType(pattern, modality).filter((w) => w.weekday === wd);

  const slots = availableSlots({ org, date, durationMin: appt.durationMin, existing, now: clockNow(), windows });
  return { ok: true, slots: slots.map((sl) => ({ start: sl.start, label: sl.label })) };
}

/** The reschedule panel's day view: which times this session can move to. */
export async function getRescheduleSlots(
  raw: { appointmentId: string; date: string },
): Promise<{ ok: true; slots: { start: string; label: string }[] } | { ok: false; error: string }> {
  const { membership } = await requireOrg([...SCHEDULERS]);
  const parsed = z.object({ appointmentId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (process.env.DATA_PROVIDER !== "db") return { ok: true, slots: [] };
  return computeRescheduleSlots(membership.orgId, parsed.data.appointmentId, parsed.data.date);
}

export async function rescheduleAppointment(
  raw: z.input<typeof rescheduleInput>,
): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = rescheduleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  let moved = 1;
  if (process.env.DATA_PROVIDER === "db") {
    // Batch 3s - the new time must be one the practice actually offers: org
    // hours for that day, the counsellor's windows for this session type, no
    // clashes. A closed Saturday picked off a little calendar no longer slips
    // through, whatever surface posted it.
    const { date: newDate, hhmm } = sastParts(parsed.data.newStart);
    const offered = await computeRescheduleSlots(membership.orgId, parsed.data.appointmentId, newDate);
    if (!offered.ok) return offered;
    if (!offered.slots.some((sl) => sastParts(sl.start).hhmm === hhmm)) {
      return { ok: false, error: "The practice isn't open then, or the counsellor doesn't work that way at that time - pick one of the offered times." };
    }
    try {
      moved = await persistReschedule(membership.orgId, parsed.data.appointmentId, parsed.data.newStart, parsed.data.scope, parsed.data.note ?? null);
    } catch (e) {
      if (isSlotTakenError(e)) return { ok: false, error: SLOT_TAKEN_MESSAGE };
      throw e;
    }
    if (moved === 0) return { ok: false, error: "That session couldn't be found." };
    await notifyAppointment(parsed.data.appointmentId, "rescheduled");
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: `reschedule_${parsed.data.scope}`,
  });
  return { ok: true, moved };
}

/**
 * Cancel with a reason (kept on the record). `scope: "following"` cancels this +
 * every later session in the series. Cancelling frees the slot.
 */
const cancelInput = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().max(280).default(""),
  scope,
});

export async function cancelAppointment(
  raw: z.input<typeof cancelInput>,
): Promise<{ ok: true; cancelled: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = cancelInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  let cancelled = 1;
  if (process.env.DATA_PROVIDER === "db") {
    cancelled = await persistCancel(membership.orgId, parsed.data.appointmentId, parsed.data.reason, parsed.data.scope);
    if (cancelled === 0) return { ok: false, error: "That session couldn't be found." };
    await notifyAppointment(parsed.data.appointmentId, "cancelled");
    void offerFreedSlot(membership.orgId, parsed.data.appointmentId); // waitlist auto-offer (W7)
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: `cancel_${parsed.data.scope}`,
  });
  return { ok: true, cancelled };
}

/* ── No-show follow-up (W7) ────────────────────────────────────────────── */

const noShowInput = z.object({ appointmentId: z.string().min(1) });

/** Dismiss a no-show from the follow-up list (rebooked elsewhere, or handled offline). */
export async function resolveNoShow(
  raw: z.infer<typeof noShowInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = noShowInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (process.env.DATA_PROVIDER === "db") await markNoShowFollowedUpDb(membership.orgId, parsed.data.appointmentId);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: "no_show_resolved",
  });
  return { ok: true };
}

/** Send the client a "we missed you - let's rebook" follow-up over their preferred channel. */
export async function sendNoShowFollowUp(
  raw: z.infer<typeof noShowInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = noShowInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [appt] = await getDb().select({ orgId: appointments.orgId }).from(appointments).where(eq(appointments.id, parsed.data.appointmentId)).limit(1);
  if (!appt || appt.orgId !== membership.orgId) return { ok: false, error: "Session not found." };
  if (process.env.DATA_PROVIDER === "db") await notifyAppointment(parsed.data.appointmentId, "no_show", null, "followup");
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: "no_show_followup_sent",
  });
  return { ok: true };
}

/**
 * "We need more sessions" - add N weekly sessions to the end of an existing
 * recurring series. This is the ONLY way a counsellor adds sessions from the
 * workspace: continuation of care on an existing client's series, never a fresh
 * booking (those live with the practice). A counsellor can extend only their own
 * series - enforced here, not just hidden in the UI. Conflicts are rejected
 * atomically by the DB exclusion constraints. Audited; the client is notified.
 */
const extendInput = z.object({
  seriesId: z.string().min(1),
  addCount: z.number().int().min(1).max(12),
});

export async function extendSeries(
  raw: z.infer<typeof extendInput>,
): Promise<{ ok: true; added: number; lastDate: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = extendInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };

  // A counsellor may extend only their own series; hub roles may extend any.
  let ownCounsellorId: string | undefined;
  if (membership.teamRole === "counsellor") {
    const { counsellors } = await import("@/db/schema");
    const { and } = await import("drizzle-orm");
    const [mine] = await getDb().select({ id: counsellors.id }).from(counsellors)
      .where(and(eq(counsellors.orgId, membership.orgId), eq(counsellors.userId, principal.userId))).limit(1);
    if (!mine) return { ok: false, error: "No counsellor profile found for your account." };
    ownCounsellorId = mine.id;
  }

  const { extendAppointmentSeries } = await import("@/db/queries/appointments");
  let res: Awaited<ReturnType<typeof extendAppointmentSeries>>;
  try {
    res = await extendAppointmentSeries(membership.orgId, parsed.data.seriesId, parsed.data.addCount, { counsellorId: ownCounsellorId });
  } catch (e) {
    if (isSlotTakenError(e)) return { ok: false, error: "One of the new weeks clashes with another booking - ask your practice admin to fit it in." };
    throw e;
  }
  if ("error" in res) {
    return { ok: false, error: res.error === "not_yours" ? "That series belongs to another counsellor." : "That series couldn't be found." };
  }

  // The client hears about it - in-app always, email when the rail is on. Bounded
  // so a slow provider never makes the button feel broken.
  const { notifyAppointmentBooked } = await import("@/lib/messaging/notify");
  await Promise.race([
    notifyAppointmentBooked(res.firstNewId),
    new Promise((resolve) => setTimeout(resolve, 4_000)),
  ]);

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `series:${parsed.data.seriesId}`,
    reason: `extend_series:${res.added}`,
  });
  return { ok: true, added: res.added, lastDate: res.lastStartsAt.toISOString() };
}

/* ── Edit the substance of a booking (batch 2v) ──────────────────────────────
 * Service, counsellor, where, room, duration - changed in place instead of
 * cancel-and-rebook. Date/time stays with rescheduleAppointment: moving in time
 * and changing what the session IS are different decisions.
 */
const updateDetailsInput = z.object({
  appointmentId: z.string().min(1),
  serviceId: z.string().min(1).optional(),
  counsellorId: z.string().min(1).optional(),
  type: z.enum(APPOINTMENT_TYPES).optional(),
  roomId: z.string().min(1).nullable().optional(),
  durationMin: z.number().int().min(10).max(600).optional(),
  scope,
});

export async function updateAppointmentDetails(
  raw: z.input<typeof updateDetailsInput>,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = updateDetailsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const d = parsed.data;
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };

  const { getDb } = await import("@/db/client");
  const { appointments } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const db = getDb();
  const [appt] = await db.select().from(appointments)
    .where(and(eq(appointments.id, d.appointmentId), eq(appointments.orgId, membership.orgId))).limit(1);
  if (!appt) return { ok: false, error: "That session couldn't be found." };
  if (appt.state === "cancelled") return { ok: false, error: "A cancelled session can't be edited." };

  // Editing what a session IS - service, counsellor, where, room, length -
  // is the practice's call, full stop. Counsellors keep reschedule, cancel
  // and the status marks; changing the substance goes through the hub.
  if (membership.teamRole === "counsellor") {
    return { ok: false, error: "Editing a session's details is done by the practice - ask your admin." };
  }

  const nextType = (d.type ?? appt.type) as import("@/lib/domain/enums").AppointmentType;
  const nextRoom = d.roomId !== undefined ? d.roomId : appt.roomId;
  if (needsRoom(nextType) && !nextRoom) return { ok: false, error: "Pick a room for an in-person or hybrid session." };

  // The (possibly new) counsellor must actually work this slot, this way -
  // the same availability rule booking enforces (batch 2n).
  const nextCounsellor = d.counsellorId ?? appt.counsellorId;
  const { getCounsellorAvailabilityDb, windowsForType } = await import("@/db/queries/availability");
  const pattern = await getCounsellorAvailabilityDb(membership.orgId, nextCounsellor);
  if (pattern.length > 0) {
    const sastDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(appt.startsAt);
    const sastTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(appt.startsAt);
    const wd = isoWeekday(sastDay);
    const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const from = hm(sastTime);
    const to = from + (d.durationMin ?? appt.durationMin);
    const fits = windowsForType(pattern, nextType).some((w) => w.weekday === wd && from >= hm(w.start) && to <= hm(w.end));
    if (!fits) {
      const how = nextType === "online" ? "online" : nextType === "hybrid" ? "for a hybrid session" : "in person";
      return { ok: false, error: `That counsellor doesn't work ${how} at this time. Reschedule first, or pick someone else.` };
    }
  }

  let updated = 0;
  try {
    const { updateAppointmentDetailsDb } = await import("@/db/queries/appointments");
    updated = await updateAppointmentDetailsDb(membership.orgId, d.appointmentId, {
      serviceId: d.serviceId, counsellorId: d.counsellorId, type: d.type,
      roomId: nextType === "online" ? null : d.roomId, durationMin: d.durationMin,
    }, d.scope);
  } catch (e) {
    if (isSlotTakenError(e)) return { ok: false, error: SLOT_TAKEN_MESSAGE };
    throw e;
  }
  if (updated === 0) return { ok: false, error: "Nothing to change." };

  // Honest notifications, in-app: there is no "details changed" email template
  // yet, and a "rescheduled" one would say the wrong thing. The client hears
  // when HOW they meet changed; a newly assigned counsellor hears always.
  try {
    const { notifyClientUser, notifyCounsellor } = await import("@/db/queries/notifications");
    if (d.type && d.type !== appt.type) {
      const how = nextType === "online" ? "an online video session" : nextType === "hybrid" ? "a hybrid session (you join online)" : "an in-person session";
      await notifyClientUser(appt.clientId, membership.orgId, {
        kind: "appointment_updated",
        title: "Your session has changed",
        body: `Your upcoming session is now ${how}. The date and time are unchanged.`,
        href: "/me/sessions",
      });
    }
    if (d.counsellorId && d.counsellorId !== appt.counsellorId) {
      await notifyCounsellor(d.counsellorId, {
        kind: "appointment_assigned",
        title: "A session was assigned to you",
        body: "A booking was moved to your calendar. Check your day.",
        href: "/app/appointments",
      });
    }
  } catch { /* the edit stands even if a bell doesn't ring */ }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${d.appointmentId}`,
    reason: `edit_details_${d.scope}`,
  });
  return { ok: true, updated };
}
