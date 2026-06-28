"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Personal account actions  usable by any org member (counsellor or admin) on
 * their **own** account. Mock: validated + audited; never logs the password.
 * Phase 9 wires TOTP + the real password store.
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
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/password`,
    reason: "change_password",
  });
  return { ok: true };
}

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

/** Update your own profile (mock). Phase 10 persists to the member row. */
export async function saveMyProfile(
  raw: z.infer<typeof profileInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/profile`,
    reason: "update_own_profile",
  });
  return { ok: true };
}
