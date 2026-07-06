"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data-provider";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { TEAM_ROLES } from "@/lib/domain/enums";

/**
 * Team management (W1.4, DB-backed). Membership lives in `org_members` (+ the
 * `counsellors` row for clinical members); every write runs through the provider
 * seam under `runForOrg` so RLS scopes it to the caller's org. A role change is the
 * capability boundary — it never grants retroactive access to clinical notes
 * (Care-Confidentiality Rule, roles.ts).
 */
const manageInput = z.object({
  userId: z.string().min(1),
  teamRole: z.enum(TEAM_ROLES),
  isSupervisor: z.boolean(),
  /** The counsellor this member reports to for clinical supervision (or null). */
  supervisorCounsellorId: z.string().nullable().optional(),
  counsellorId: z.string().nullable().optional(),
});

export async function saveTeamMember(
  raw: z.infer<typeof manageInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = manageInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  if (parsed.data.isSupervisor && parsed.data.teamRole !== "counsellor") {
    return { ok: false, error: "Only a counsellor can also be a supervisor." };
  }
  if (parsed.data.supervisorCounsellorId && parsed.data.supervisorCounsellorId === parsed.data.counsellorId) {
    return { ok: false, error: "A counsellor can't supervise themselves." };
  }

  const provider = await getDataProvider();
  const res = await provider.saveTeamMember(membership.orgId, {
    userId: parsed.data.userId,
    teamRole: parsed.data.teamRole,
    isSupervisor: parsed.data.isSupervisor,
    supervisorCounsellorId: parsed.data.supervisorCounsellorId,
    counsellorId: parsed.data.counsellorId,
  });
  if (!res.ok) return { ok: false, error: "That member could not be found." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:${parsed.data.userId}`,
    reason: parsed.data.supervisorCounsellorId !== undefined ? "update_member_supervision" : "update_member",
  });
  revalidatePath("/hub/team");
  return { ok: true };
}

/** Archive (revoke access) or restore a member — access is gated on membership status. */
export async function setMemberStatus(
  raw: { userId: string; status: "active" | "archived" },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw.userId) return { ok: false, error: "Invalid member." };
  if (raw.userId === principal.userId) return { ok: false, error: "You can't change your own access here." };
  if (raw.status !== "active" && raw.status !== "archived") return { ok: false, error: "Invalid status." };

  const provider = await getDataProvider();
  const res = await provider.setMemberStatus(membership.orgId, raw.userId, raw.status);
  if (!res.ok) return { ok: false, error: "That member could not be found." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:${raw.userId}`,
    reason: raw.status === "archived" ? "archive_member" : "restore_member",
  });
  revalidatePath("/hub/team");
  return { ok: true };
}

const inviteInput = z.object({
  name: z.string().min(2, "Enter their name."),
  email: z.string().email("Enter a valid email."),
  teamRole: z.enum(TEAM_ROLES),
});

/** (Re)send a member their set-password link. Phase 12 delivers the email itself. */
export async function sendSetupLink(
  raw: { userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw.userId) return { ok: false, error: "Invalid member." };
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:${raw.userId}/setup_link`,
    reason: "send_setup_link",
  });
  return { ok: true };
}

export async function inviteMember(
  raw: z.infer<typeof inviteInput>,
): Promise<{ ok: true } | { ok: false; error: string; existing?: boolean }> {
  const { principal, membership } = await requireHub();
  const parsed = inviteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  const provider = await getDataProvider();
  const { existing } = await provider.inviteTeamMember(
    membership.orgId,
    { name: parsed.data.name, email: parsed.data.email, teamRole: parsed.data.teamRole },
    new Date().toISOString(),
  );

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:invite:${parsed.data.email}`,
    reason: existing ? "invite_existing_user" : "invite_member",
  });
  revalidatePath("/hub/team");
  return { ok: true };
}
