"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { logAccess } from "@/lib/audit";
import { requireOrg } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import { appointments } from "@/db/schema";
import { rescheduleAppointment as persistReschedule, cancelAppointment as persistCancel } from "@/db/queries/appointments";
import { isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/db/queries/errors";
import { notifyAppointment } from "@/lib/messaging/notify";
import { videoJoinPath } from "@/lib/video/livekit";

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

export async function rescheduleAppointment(
  raw: z.input<typeof rescheduleInput>,
): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = rescheduleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  let moved = 1;
  if (process.env.DATA_PROVIDER === "db") {
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
