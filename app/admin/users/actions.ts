"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { auth } from "@/lib/auth/better-auth";
import { logAccess } from "@/lib/audit";
import { invitePlatformOperatorDb, revokePlatformOperatorDb, getOperatorEmailDb } from "@/db/queries/platform";

/**
 * Platform user management (super-admin). Invite/manage other platform operators —
 * reuses the invited-member activation flow: create the super-admin + a credential
 * account, then email a branded set-password link (Better Auth reset token).
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

async function emailSetupLink(email: string): Promise<void> {
  if (!isDb()) return;
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch {
    /* best-effort; honest dormant fallback */
  }
}

const inviteInput = z.object({
  name: z.string().trim().min(2, "Enter their name."),
  email: z.string().trim().email("Enter a valid email."),
});

export async function invitePlatformOperator(raw: z.infer<typeof inviteInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = inviteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  if (!isDb()) return { ok: true };

  const { existing } = await invitePlatformOperatorDb(parsed.data.name, parsed.data.email, new Date().toISOString());
  await emailSetupLink(parsed.data.email);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `operator:invite:${parsed.data.email}`, reason: existing ? "promote_operator" : "invite_operator" });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resendOperatorLink(raw: { userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  if (!raw.userId) return { ok: false, error: "Invalid operator." };
  if (!isDb()) return { ok: true };

  const email = await getOperatorEmailDb(raw.userId);
  if (!email) return { ok: false, error: "That operator could not be found." };
  await emailSetupLink(email);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `operator:${raw.userId}/setup_link`, reason: "resend_operator_link" });
  return { ok: true };
}

export async function revokeOperator(raw: { userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  if (!raw.userId) return { ok: false, error: "Invalid operator." };
  if (raw.userId === principal.userId) return { ok: false, error: "You can't revoke your own operator access." };
  if (!isDb()) return { ok: true };

  const res = await revokePlatformOperatorDb(raw.userId);
  if (!res.ok) return { ok: false, error: "That operator could not be found." };
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `operator:${raw.userId}`, reason: "revoke_operator" });
  revalidatePath("/admin/users");
  return { ok: true };
}
