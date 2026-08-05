"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/guard";
import { auth } from "@/lib/auth/better-auth";
import { logAccess } from "@/lib/audit";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Personal account actions — usable by any org member (counsellor or admin) on
 * their **own** account. Real: the password change routes through Better Auth
 * (verifies the current password, re-hashes, revokes other sessions) and the
 * profile persists to `team_profiles`. Never logs the password.
 */
const passwordInput = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(8, "Use at least 8 characters.").max(200),
  confirm: z.string().min(1),
});

export async function changePassword(
  raw: z.infer<typeof passwordInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = passwordInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.next !== parsed.data.confirm) return { ok: false, error: "The new passwords don't match." };
  if (parsed.data.next === parsed.data.current) return { ok: false, error: "Choose a password different from your current one." };
  if (isDb()) {
    try {
      await auth.api.changePassword({
        body: { currentPassword: parsed.data.current, newPassword: parsed.data.next, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch {
      return { ok: false, error: "Your current password isn't right." };
    }
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/password`,
    reason: "change_password",
  });
  return { ok: true };
}

/**
 * 2FA: turning it ON is a real enrolment flow (TOTP QR + verify + backup codes)
 * via the Better Auth twoFactor plugin — a boolean toggle can't honestly
 * represent that, so this records the intent (audited) rather than pretend 2FA
 * is active. The enrolment UI is the W2 2FA work item.
 */
export async function setTwoFactor(raw: { enabled: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/2fa`,
    reason: raw.enabled ? "enable_2fa" : "disable_2fa",
  });
  return { ok: true };
}

const profileInput = z.object({
  name: z.string().min(2, "Enter your full name."),
  phone: z.string().regex(/^(\+27|0)\d{9}$/, "Use a SA number.").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  languages: z.string().max(200).optional().or(z.literal("")),
  bio: z.string().max(800).optional().or(z.literal("")),
});

/** Update your own profile — persists to `team_profiles` (+ your display name). */
export async function saveMyProfile(
  raw: z.infer<typeof profileInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  if (isDb()) {
    const d = parsed.data;
    const { getDb } = await import("@/db/client");
    const { teamProfiles, counsellors } = await import("@/db/schema");
    const { user } = await import("@/db/auth-schema");
    const { and, eq } = await import("drizzle-orm");
    const db = getDb();
    const values = {
      phone: d.phone || null, dateOfBirth: d.dateOfBirth || null, address: d.address || null,
      languages: (d.languages ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      bio: d.bio || null,
    };
    const [existing] = await db.select({ id: teamProfiles.id }).from(teamProfiles)
      .where(and(eq(teamProfiles.orgId, membership.orgId), eq(teamProfiles.userId, principal.userId))).limit(1);
    if (existing) await db.update(teamProfiles).set(values).where(eq(teamProfiles.id, existing.id));
    else await db.insert(teamProfiles).values({ orgId: membership.orgId, userId: principal.userId, ...values });
    // Display name follows everywhere it appears.
    await db.update(user).set({ name: d.name }).where(eq(user.id, principal.userId));
    await db.update(counsellors).set({ name: d.name })
      .where(and(eq(counsellors.orgId, membership.orgId), eq(counsellors.userId, principal.userId)));
    revalidatePath("/app/settings");
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/profile`,
    reason: "update_own_profile",
  });
  return { ok: true };
}
