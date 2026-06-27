"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { TEAM_ROLES } from "@/lib/domain/enums";

/**
 * Team management (mock). Validated + audited; Phase 10 persists membership and
 * the role becomes the RLS capability boundary. A role change never grants
 * retroactive access to clinical notes (Care-Confidentiality Rule).
 */
const manageInput = z.object({
  userId: z.string().min(1),
  teamRole: z.enum(TEAM_ROLES),
  isSupervisor: z.boolean(),
  active: z.boolean(),
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

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:${parsed.data.userId}`,
    reason: "update_member",
  });
  return { ok: true };
}

const inviteInput = z.object({
  name: z.string().min(2, "Enter their name."),
  email: z.string().email("Enter a valid email."),
  teamRole: z.enum(TEAM_ROLES),
});

export async function inviteMember(
  raw: z.infer<typeof inviteInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = inviteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:invite:${parsed.data.email}`,
    reason: "invite_member",
  });
  return { ok: true };
}
