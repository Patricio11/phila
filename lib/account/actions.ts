"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/guard";
import { auth } from "@/lib/auth/better-auth";
import { logAccess } from "@/lib/audit";
import { AVAILABILITY_MODES } from "@/lib/domain/enums";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Personal account actions - usable by any org member (counsellor or admin) on
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
 * via the Better Auth twoFactor plugin - a boolean toggle can't honestly
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

/** Update your own profile - persists to `team_profiles` (+ your display name). */
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

/* ── Own availability (batch 2n) - a counsellor keeps their own hours ────────
 * The practice still owns oversight: every save notifies the org admins and
 * lands on the activity feed as `update_availability`. Windows carry a mode, so
 * "Tuesday evenings, online only" is expressible and booking honours it.
 */

const myWindowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  mode: z.enum(AVAILABILITY_MODES).default("both"),
});

export async function saveMyAvailability(
  raw: { windows: z.infer<typeof myWindowSchema>[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const parsed = z.object({ windows: z.array(myWindowSchema).max(84) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the availability times." };
  const windows = parsed.data.windows;
  for (const w of windows) {
    if (w.end <= w.start) return { ok: false, error: "Each window must end after it starts." };
  }
  if (!isDb()) return { ok: true };

  // Only a counsellor has availability, and only over their OWN record.
  const { getDb } = await import("@/db/client");
  const { counsellors } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [mine] = await getDb().select({ id: counsellors.id, name: counsellors.name }).from(counsellors)
    .where(and(eq(counsellors.orgId, membership.orgId), eq(counsellors.userId, principal.userId))).limit(1);
  if (!mine) return { ok: false, error: "Only counsellors keep an availability pattern." };

  const { saveCounsellorAvailabilityDb } = await import("@/db/queries/availability");
  await saveCounsellorAvailabilityDb(membership.orgId, mine.id, windows);

  // The practice hears about it: the bell for every admin, plus the audit trail
  // the activity feed reads. Neither may break the save.
  const summary = windows.length === 0
    ? "now follows the practice working hours"
    : `now works ${windows.length} window${windows.length === 1 ? "" : "s"} a week`
      + (windows.some((w) => w.mode !== "both") ? " (split by in person / online)" : "");
  try {
    const { notifyOrgAdmins } = await import("@/db/queries/notifications");
    await notifyOrgAdmins(membership.orgId, {
      kind: "availability_changed",
      title: `${mine.name} updated their availability`,
      body: `${mine.name.split(" ")[0]} ${summary}. Bookings follow the new pattern from now on.`,
      href: `/hub/team/${mine.id}`,
    });
  } catch { /* the save stands even if the bell doesn't ring */ }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `counsellor:${mine.id}/availability`,
    reason: "update_availability",
  });
  revalidatePath("/app/settings");
  revalidatePath("/hub/team");
  return { ok: true };
}

/* ── Profile photo (batch 2n) - a member's own picture ───────────────────────
 * Same pipeline as the org logo: presign, the browser PUTs the bytes, then we
 * scan and record. The image counts against the practice's storage, and
 * replacing one releases the old bytes. Nobody uploads for anybody else.
 */

const PHOTO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

export async function requestMyPhotoUpload(
  raw: { contentType: string; bytes: number },
): Promise<{ ok: true; uploadUrl: string; key: string; bytes: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const contentType = String(raw?.contentType ?? "");
  const bytes = Number(raw?.bytes ?? 0);
  if (!PHOTO_TYPES.has(contentType)) return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  if (!(bytes > 0) || bytes > PHOTO_MAX_BYTES) return { ok: false, error: "Keep the photo under 3 MB." };
  if (!isDb()) return { ok: false, error: "Photos need the database provider." };

  const { getStorageProvider } = await import("@/lib/storage");
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Phila Storage isn't switched on yet." };

  // Net of the photo it replaces, so re-uploading never eats the quota twice.
  const { currentStorageBytes } = await import("@/db/queries/documents");
  const { orgStorageLimitBytes } = await import("@/db/queries/resources");
  const { getMemberPhotoDb } = await import("@/db/queries/team");
  const [used, current, limit] = await Promise.all([
    currentStorageBytes(membership.orgId),
    getMemberPhotoDb(membership.orgId, principal.userId),
    orgStorageLimitBytes(membership.orgId),
  ]);
  if (used - current.bytes + bytes > limit) return { ok: false, error: "Your practice has reached its storage. Remove files or upgrade for more." };

  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const { randomUUID } = await import("node:crypto");
  const key = `${membership.orgId}/avatars/${principal.userId}-${randomUUID()}.${ext}`;
  try {
    const { uploadUrl } = await storage.signedUploadUrl({ key, contentType });
    return { ok: true, uploadUrl, key, bytes };
  } catch {
    return { ok: false, error: "Storage rejected the upload - check the Phila Storage configuration." };
  }
}

export async function confirmMyPhotoUpload(
  raw: { key: string; bytes: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  const key = String(raw?.key ?? "");
  const bytes = Number(raw?.bytes ?? 0);
  // The key must be the one we minted for THIS member, in THIS practice.
  if (!key.startsWith(`${membership.orgId}/avatars/${principal.userId}-`) || bytes <= 0) return { ok: false, error: "Invalid upload." };
  if (!isDb()) return { ok: false, error: "Photos need the database provider." };

  const { getStorageProvider } = await import("@/lib/storage");
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Files aren't available right now." };
  const { scanObject } = await import("@/lib/documents/scan");
  if ((await scanObject(key)) !== "clean") {
    try { await storage.remove(key); } catch { /* best effort */ }
    return { ok: false, error: "That image didn't pass the security scan." };
  }

  const { getMemberPhotoDb, saveMemberPhotoDb } = await import("@/db/queries/team");
  const { addStorageUsage } = await import("@/db/queries/documents");
  const { activeStorageBackend } = await import("@/lib/storage");
  const prev = await getMemberPhotoDb(membership.orgId, principal.userId);
  await saveMemberPhotoDb(membership.orgId, principal.userId, key, bytes, await activeStorageBackend());
  await addStorageUsage(membership.orgId, bytes - prev.bytes);
  // The old one may live on the backend we have since switched away from.
  if (prev.key && prev.key !== key) {
    try { await (await getStorageProvider(prev.backend)).remove(prev.key); } catch { /* best effort */ }
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/photo`,
    reason: "set_profile_photo",
  });
  revalidatePath("/app/settings");
  revalidatePath("/hub/team");
  return { ok: true };
}

export async function removeMyPhoto(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg();
  if (!isDb()) return { ok: false, error: "Photos need the database provider." };
  const { getMemberPhotoDb, saveMemberPhotoDb } = await import("@/db/queries/team");
  const { addStorageUsage } = await import("@/db/queries/documents");
  const prev = await getMemberPhotoDb(membership.orgId, principal.userId);
  await saveMemberPhotoDb(membership.orgId, principal.userId, null, 0);
  if (prev.bytes > 0) await addStorageUsage(membership.orgId, -prev.bytes);
  if (prev.key) {
    try { (await (await import("@/lib/storage")).getStorageProvider(prev.backend)).remove(prev.key); } catch { /* best effort */ }
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `user:${principal.userId}/photo`,
    reason: "remove_profile_photo",
  });
  revalidatePath("/app/settings");
  revalidatePath("/hub/team");
  return { ok: true };
}
