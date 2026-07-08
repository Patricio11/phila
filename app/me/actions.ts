"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import { appointments, orgs, orgMembers } from "@/db/schema";
import { createChangeRequestDb } from "@/db/queries/appointment-requests";
import { createNotification, notifyCounsellor } from "@/db/queries/notifications";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";

const requestInput = z.object({
  appointmentId: z.string().min(1),
  kind: z.enum(["reschedule", "cancel"]),
  reason: z.string().trim().min(5, "Please add a short reason so we can help.").max(500),
});

/**
 * A client REQUESTS a reschedule or cancellation (W6.2) — they never change the booking
 * themselves. We verify the session is theirs and still upcoming, enforce the org's notice
 * window (closer than that, they're asked to phone), record the request, and notify the
 * practice. The practice actions or declines it.
 */
export async function requestAppointmentChange(
  raw: z.infer<typeof requestInput>,
): Promise<{ ok: true } | { ok: false; error: string; contact?: { name: string; phone: string | null } }> {
  const { principal, clientId } = await requireClient();
  const parsed = requestInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your request." };

  const db = getDb();
  const [appt] = await db.select({
    id: appointments.id, orgId: appointments.orgId, clientId: appointments.clientId,
    counsellorId: appointments.counsellorId, startsAt: appointments.startsAt, state: appointments.state,
  }).from(appointments).where(eq(appointments.id, parsed.data.appointmentId)).limit(1);

  // Ownership + validity — never reveal another client's session.
  if (!appt || appt.clientId !== clientId) return { ok: false, error: "That session couldn't be found." };
  if (appt.state === "cancelled") return { ok: false, error: "That session is already cancelled." };

  const [org] = await db.select({ name: orgs.name, scheduling: orgs.scheduling, profile: orgs.profile }).from(orgs).where(eq(orgs.id, appt.orgId)).limit(1);
  const nowMs = new Date(clockNow()).getTime();
  const minsUntil = (appt.startsAt.getTime() - nowMs) / 60_000;
  if (minsUntil <= 0) return { ok: false, error: "That session has already started  please contact the practice." };

  const noticeHours = (org?.scheduling as Record<string, number> | undefined)?.changeNoticeHours ?? 24;
  const phone = (org?.profile as Record<string, string> | undefined)?.phone ?? null;
  if (noticeHours > 0 && minsUntil < noticeHours * 60) {
    return {
      ok: false,
      error: `It's less than ${noticeHours} hours before your session, so this can't be changed online. Please contact ${org?.name ?? "the practice"} directly.`,
      contact: { name: org?.name ?? "the practice", phone },
    };
  }

  const created = await createChangeRequestDb({
    id: `acr_${randomUUID()}`, orgId: appt.orgId, appointmentId: appt.id, clientId,
    kind: parsed.data.kind, reason: parsed.data.reason,
  });
  if (!created) return { ok: false, error: "You already have a request pending for this session  the practice will be in touch." };

  // Notify the counsellor + the org's schedulers (org_admin / front_desk).
  const verb = parsed.data.kind === "cancel" ? "cancel" : "reschedule";
  const title = `Client requests to ${verb} a session`;
  const body = `${principal.name}: “${parsed.data.reason}”`;
  const href = "/hub/appointments";
  await notifyCounsellor(appt.counsellorId, { kind: "change_request", title, body, href });
  const schedulers = await db.select({ userId: orgMembers.userId })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, appt.orgId), inArray(orgMembers.teamRole, ["org_admin", "front_desk"]), eq(orgMembers.status, "active")));
  for (const s of schedulers) await createNotification({ userId: s.userId, orgId: appt.orgId, kind: "change_request", title, body, href });

  await logAccess({
    action: "client.action",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: appt.orgId,
    target: `appointment:${appt.id}`,
    reason: `request_${parsed.data.kind}`,
  });
  revalidatePath("/me");
  return { ok: true };
}

/** Which of the given appointments already have a pending change request (for the UI state). */
export async function pendingRequestsFor(appointmentIds: string[]): Promise<Record<string, "reschedule" | "cancel">> {
  await requireClient();
  const { pendingRequestKindsDb } = await import("@/db/queries/appointment-requests");
  return pendingRequestKindsDb(appointmentIds);
}
