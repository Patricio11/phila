"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/auth/guard";
import { auth } from "@/lib/auth/better-auth";
import { logAccess } from "@/lib/audit";
import { runForClient } from "@/lib/db/scoped";
import { saveClientProfileDb } from "@/db/queries/client-profile";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Client self-service account actions. A client edits their own record; validated +
 * audited, never logs the password. Persisted under RLS (own-record access via the
 * client's org). Password/2FA changes still route through Better Auth (see below).
 */
const profileInput = z.object({
  name: z.string().min(2, "Enter your full name."),
  phone: z.string().regex(/^(\+27|0)\d{9}$/, "Use a SA number.").optional().or(z.literal("")),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  emergencyName: z.string().max(120).optional().or(z.literal("")),
  emergencyPhone: z.string().optional().or(z.literal("")),
  preferredContact: z.enum(["WhatsApp", "Phone call", "Email"]),
});

export async function saveClientProfile(
  raw: z.infer<typeof profileInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  if (isDb()) {
    const { name, phone, email, ...extra } = parsed.data;
    const profile = Object.fromEntries(Object.entries(extra).filter(([, v]) => (v ?? "").trim() !== "")) as Record<string, string>;
    await runForClient(clientId, undefined, () => saveClientProfileDb(clientId, { name, phone: phone ?? "", email: email ?? "" }, profile));
  }
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: null,
    target: `client:${clientId}/profile`,
    reason: "update_own_profile",
  });
  revalidatePath("/me/profile");
  return { ok: true };
}

const passwordInput = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(8, "Use at least 8 characters.").max(200),
  confirm: z.string().min(1),
});

export async function changeClientPassword(
  raw: z.infer<typeof passwordInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const parsed = passwordInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.next !== parsed.data.confirm) return { ok: false, error: "The new passwords don't match." };
  if (parsed.data.next === parsed.data.current) return { ok: false, error: "Choose a password different from your current one." };
  // Real password change via Better Auth (verifies the current password, re-hashes,
  // and revokes other sessions). Never logs the password itself.
  try {
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.current, newPassword: parsed.data.next, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Your current password isn't right." };
  }
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: null,
    target: `client:${clientId}/password`,
    reason: "change_password",
  });
  return { ok: true };
}

/**
 * 2FA for the client. Turning it ON is a real enrolment flow (TOTP QR + verify a
 * code + backup codes) via the Better Auth twoFactor plugin  a boolean toggle can't
 * honestly represent that, so this stays a no-op placeholder (audited) rather than
 * pretend 2FA is active. The real enrolment UI lands with the W2 2FA prompt work.
 */
export async function setClientTwoFactor(raw: { enabled: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: null,
    target: `client:${clientId}/2fa`,
    reason: raw.enabled ? "enable_2fa" : "disable_2fa",
  });
  return { ok: true };
}

/**
 * Phase 31.1 - client-initiated DSAR request. The client doesn't run the export/
 * erasure themselves; the request is routed to the practice (the responsible
 * party), who runs the one-click action from the client's Data & privacy panel.
 */
export async function requestMyData(
  raw: { kind: "export" | "deletion" },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const kind = raw.kind === "deletion" ? "deletion" : "export";
  const { principal, clientId } = await requireClient();
  if (!isDb()) return { ok: false, error: "Not available in demo mode." };

  const { getDb } = await import("@/db/client");
  const { clients, orgMembers } = await import("@/db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { createNotification } = await import("@/db/queries/notifications");

  const db = getDb();
  const [me] = await db.select({ orgId: clients.orgId, name: clients.name }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!me) return { ok: false, error: "Account not found." };

  const admins = await db.select({ userId: orgMembers.userId })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, me.orgId), inArray(orgMembers.teamRole, ["org_admin", "front_desk"]), eq(orgMembers.status, "active")));
  for (const a of admins) {
    await createNotification({
      userId: a.userId, orgId: me.orgId, kind: "dsar_request",
      title: kind === "export" ? `${me.name} requested a copy of their data` : `${me.name} requested deletion of their data`,
      body: `Open their profile → Data & privacy to action it (POPIA request, respond within a reasonable time).`,
      href: `/hub/clients/${clientId}`,
    });
  }

  await logAccess({
    action: "client.action",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: me.orgId,
    target: `client:${clientId}`,
    reason: kind === "export" ? "dsar_request_export" : "dsar_request_deletion",
  });
  return { ok: true };
}
