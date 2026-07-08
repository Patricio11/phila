"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/guard";
import { getChangeRequestDb, resolveChangeRequestDb } from "@/db/queries/appointment-requests";
import { cancelAppointment as persistCancel } from "@/db/queries/appointments";
import { notifyAppointment } from "@/lib/messaging/notify";
import { notifyClientUser } from "@/db/queries/notifications";
import { logAccess } from "@/lib/audit";

/** Who may action a client's change request: the counsellor, the org admin, or reception. */
const SCHEDULERS = ["counsellor", "org_admin", "front_desk"] as const;

const resolveInput = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approve", "decline"]),
});

/**
 * Approve or decline a client's change request (W6.2). Approving a *cancellation*
 * actually cancels the session (with the client's reason) and tells them; approving a
 * *reschedule* acknowledges it — the practice then moves the session in the calendar —
 * and tells the client to expect a new time. Declining notifies them to get in touch.
 */
export async function resolveChangeRequest(
  raw: z.infer<typeof resolveInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = resolveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (process.env.DATA_PROVIDER !== "db") return { ok: true };

  const req = await getChangeRequestDb(membership.orgId, parsed.data.requestId);
  if (!req) return { ok: false, error: "That request has already been handled." };

  if (parsed.data.decision === "decline") {
    await resolveChangeRequestDb(membership.orgId, req.id, "declined", principal.userId);
    await notifyClientUser(req.clientId, membership.orgId, {
      kind: "change_declined",
      title: `Your ${req.kind === "cancel" ? "cancellation" : "reschedule"} request`,
      body: "We couldn't action this online  please contact the practice and we'll help.",
      href: "/me",
    });
  } else if (req.kind === "cancel") {
    // Approve a cancellation → actually cancel the session.
    await persistCancel(membership.orgId, req.appointmentId, "Cancelled at the client's request", "this");
    await notifyAppointment(req.appointmentId, "cancelled");
    await resolveChangeRequestDb(membership.orgId, req.id, "approved", principal.userId);
    await notifyClientUser(req.clientId, membership.orgId, {
      kind: "change_approved", title: "Session cancelled", body: "Your session has been cancelled as requested.", href: "/me",
    });
  } else {
    // Approve a reschedule → acknowledge; the practice moves it in the calendar.
    await resolveChangeRequestDb(membership.orgId, req.id, "approved", principal.userId);
    await notifyClientUser(req.clientId, membership.orgId, {
      kind: "change_approved", title: "Reschedule underway", body: "We're arranging a new time and will confirm it with you shortly.", href: "/me",
    });
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${req.appointmentId}`,
    reason: `change_request_${parsed.data.decision}`,
  });
  revalidatePath("/hub/appointments");
  return { ok: true };
}
