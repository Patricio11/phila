"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data-provider";
import { auth } from "@/lib/auth/better-auth";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { TEAM_ROLES, AVAILABILITY_MODES } from "@/lib/domain/enums";
import { transferCaseloadDb } from "@/db/queries/clients";
import { getMemberContactDb } from "@/db/queries/team";
import { notifyCounsellor } from "@/db/queries/notifications";

const isDb = () => process.env.DATA_PROVIDER === "db";

/** Email a member their set-password / activation link (Better Auth reset token). */
async function emailSetupLink(email: string): Promise<void> {
  if (!isDb()) return;
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch {
    // Best-effort  never fail the invite/resend on a mail hiccup (honest dormant fallback).
  }
}

/**
 * Team management (W1.4, DB-backed). Membership lives in `org_members` (+ the
 * `counsellors` row for clinical members); every write runs through the provider
 * seam under `runForOrg` so RLS scopes it to the caller's org. A role change is the
 * capability boundary  it never grants retroactive access to clinical notes
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

/** Archive (revoke access) or restore a member  access is gated on membership status. */
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

/** (Re)send a member their set-password / activation link. */
export async function sendSetupLink(
  raw: { userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw.userId) return { ok: false, error: "Invalid member." };

  if (isDb()) {
    const contact = await getMemberContactDb(membership.orgId, raw.userId);
    if (!contact) return { ok: false, error: "That member could not be found." };
    await emailSetupLink(contact.email);
  }

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

  // Email the new member their set-password / activation link straight away.
  await emailSetupLink(parsed.data.email);

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

/**
 * Transfer a counsellor's whole caseload to another counsellor (Phase 18.8)  for
 * an intern leaving or a terminated contract. Every active client's primary
 * counsellor is re-pointed and all FUTURE scheduled sessions move; the clinical
 * history (past sessions, notes, outcomes, documents) stays exactly as it was.
 * The receiving counsellor gets an in-app notification. Audited.
 */
const transferInput = z.object({
  fromCounsellorId: z.string().min(1),
  toCounsellorId: z.string().min(1, "Pick the receiving counsellor."),
});

export async function transferCaseload(
  raw: z.infer<typeof transferInput>,
): Promise<{ ok: true; clients: number; movedSessions: number; skippedSessions: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = transferInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pick the receiving counsellor." };
  if (parsed.data.fromCounsellorId === parsed.data.toCounsellorId) return { ok: false, error: "Pick a different counsellor to receive the caseload." };

  let result = { clients: 0, moved: 0, skipped: 0 };
  if (process.env.DATA_PROVIDER === "db") {
    result = await transferCaseloadDb(membership.orgId, parsed.data.fromCounsellorId, parsed.data.toCounsellorId);
    if (result.clients === 0 && result.moved === 0) return { ok: false, error: "This counsellor has no active clients or upcoming sessions to transfer." };
    await notifyCounsellor(parsed.data.toCounsellorId, {
      kind: "caseload_transferred",
      title: `${result.clients} client${result.clients === 1 ? "" : "s"} transferred to you`,
      body: `${result.moved} upcoming session${result.moved === 1 ? "" : "s"} moved to your diary${result.skipped > 0 ? ` · ${result.skipped} clashed  please reschedule` : ""}. Full histories included.`,
      href: "/app/clients",
    });
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `counsellor:${parsed.data.fromCounsellorId}/caseload→${parsed.data.toCounsellorId}`,
    reason: `transfer_caseload:${result.clients}c_${result.moved}s`,
  });
  revalidatePath("/hub/team");
  revalidatePath("/hub/clients");
  return { ok: true, clients: result.clients, movedSessions: result.moved, skippedSessions: result.skipped };
}

/* ---- Counsellor offboarding (feedback #4) - archive-only, records kept ---- */

/** The dialog's honest summary: is this member a counsellor, and what would archiving orphan? */
export async function getMemberWorkload(
  raw: { userId: string },
): Promise<{ ok: true; counsellorId: string | null; upcoming: number; clients: number } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  if (!raw?.userId) return { ok: false, error: "Invalid request" };
  if (!isDb()) return { ok: true, counsellorId: null, upcoming: 0, clients: 0 };
  const { memberWorkloadDb } = await import("@/db/queries/team");
  const w = await memberWorkloadDb(membership.orgId, raw.userId);
  return { ok: true, ...w };
}

const offboardInput = z.object({
  userId: z.string().min(1),
  mode: z.enum(["migrate", "cancel", "none"]),
  toCounsellorId: z.string().optional(),
});

/**
 * Archive a counsellor PROPERLY: their caseload + upcoming sessions are either
 * migrated to a successor or cancelled (clients notified, dormant-safe) - then
 * sign-in is revoked. NOTHING is deleted: every note, session, outcome, and
 * audit line stays on the record permanently (HPCSA + Outcome-Honesty).
 */
export async function offboardMember(
  raw: z.infer<typeof offboardInput>,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = offboardInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const d = parsed.data;
  if (d.userId === principal.userId) return { ok: false, error: "You can't archive your own account." };

  let summary = "Sign-in revoked. Their history stays on record.";
  if (isDb()) {
    const { memberWorkloadDb, cancelUpcomingForCounsellorDb, setMemberStatusDb } = await import("@/db/queries/team");
    const w = await memberWorkloadDb(membership.orgId, d.userId);

    if (w.counsellorId && (w.upcoming > 0 || w.clients > 0)) {
      if (d.mode === "migrate") {
        if (!d.toCounsellorId) return { ok: false, error: "Choose who takes over their caseload." };
        const res = await transferCaseloadDb(membership.orgId, w.counsellorId, d.toCounsellorId);
        summary = `${res.clients} client${res.clients === 1 ? "" : "s"} and ${res.moved} session${res.moved === 1 ? "" : "s"} moved across`
          + (res.skipped > 0 ? ` · ${res.skipped} clashed and need${res.skipped === 1 ? "s" : ""} rebooking` : "")
          + ". History stays on record.";
        await notifyCounsellor(d.toCounsellorId, {
          kind: "caseload_transfer",
          title: "A caseload has been moved to you",
          body: `${res.clients} clients and ${res.moved} upcoming sessions are now yours.`,
          href: "/app/clients",
        });
      } else if (d.mode === "cancel") {
        const ids = await cancelUpcomingForCounsellorDb(membership.orgId, w.counsellorId, "Counsellor left the practice");
        // The dialog promises their clients stay on the books UNASSIGNED - so
        // actually unassign them, rather than leaving them pointing at an
        // archived counsellor. Their records open fine unassigned (batch 2s).
        const { unassignCaseloadDb } = await import("@/db/queries/clients");
        const freed = await unassignCaseloadDb(membership.orgId, w.counsellorId);
        void freed;
        // Clients are told, dormant-safe; bounded so the archive answers promptly.
        const { notifyAppointment } = await import("@/lib/messaging/notify");
        await Promise.race([
          Promise.allSettled(ids.map((id) => notifyAppointment(id, "cancelled"))),
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
        summary = `${ids.length} upcoming session${ids.length === 1 ? "" : "s"} cancelled and clients notified; their clients are unassigned, ready to re-place. History stays on record.`;
      } else {
        return { ok: false, error: "Choose what happens to their caseload first." };
      }
    }
    const res = await setMemberStatusDb(membership.orgId, d.userId, "archived");
    if (!res.ok) return { ok: false, error: "That member couldn't be found." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `member:${d.userId}`,
    reason: d.mode === "migrate" ? "archive_member_migrated" : d.mode === "cancel" ? "archive_member_cancelled" : "archive_member",
  });
  revalidatePath("/hub/team");
  return { ok: true, summary };
}

/* ---- Counsellor availability (feedback #5) - ORG-managed, counsellors read-only ---- */

const windowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  /** Batch 2n - which kind of session the window can hold. */
  mode: z.enum(AVAILABILITY_MODES).default("both"),
});
const availabilityInput = z.object({
  counsellorId: z.string().min(1),
  // Three modes x seven days, with room to split a day into two windows.
  windows: z.array(windowSchema).max(84),
});

/**
 * Replace a counsellor's weekly working windows (all modes in one save). The
 * org edits any member here; a counsellor edits their OWN from Settings. Every save is
 * audited as `update_availability`, which surfaces on the dashboard Activity
 * feed. No windows at all = the counsellor inherits the org's business hours.
 */
export async function saveMemberAvailability(
  raw: z.infer<typeof availabilityInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = availabilityInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the availability times." };
  const d = parsed.data;
  for (const w of d.windows) {
    if (w.end <= w.start) return { ok: false, error: "Each window must end after it starts." };
  }

  if (isDb()) {
    const { saveCounsellorAvailabilityDb } = await import("@/db/queries/availability");
    await saveCounsellorAvailabilityDb(membership.orgId, d.counsellorId, d.windows);
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `counsellor:${d.counsellorId}/availability`,
    reason: "update_availability",
  });
  revalidatePath("/hub/team");
  return { ok: true };
}

/** Feedback #9 - audit a team-list export (admin action; no clinical data involved). */
export async function auditTeamExport(
  raw: { format: "csv" | "excel" | "pdf"; count: number },
): Promise<{ ok: true }> {
  const { principal, membership } = await requireHub();
  const format = ["csv", "excel", "pdf"].includes(raw?.format) ? raw.format : "csv";
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/team.${format}`,
    reason: `team_export_${format}:${Math.max(0, Math.floor(raw?.count ?? 0))}`,
  });
  return { ok: true };
}

/** Phase 32.0 - the counsellor's spoken languages (normalised codes; org-managed). */
export async function saveSpokenLanguages(
  raw: { counsellorId: string; codes: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!raw?.counsellorId || !Array.isArray(raw?.codes)) return { ok: false, error: "Invalid request." };
  if (isDb() && !(await (await import("@/db/queries/features")).effectiveFeaturesDb(membership.orgId)).language) {
    return { ok: false, error: "Language of record isn't switched on for this practice." };
  }
  const { LANGUAGE_BY_CODE } = await import("@/lib/domain/languages");
  const codes = [...new Set(raw.codes)].filter((c) => LANGUAGE_BY_CODE.has(c));

  if (isDb()) {
    const { getDb } = await import("@/db/client");
    const { counsellors } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const res = await getDb().update(counsellors).set({ spokenLanguages: codes })
      .where(and(eq(counsellors.id, raw.counsellorId), eq(counsellors.orgId, membership.orgId)))
      .returning({ id: counsellors.id });
    if (!res.length) return { ok: false, error: "That counsellor couldn't be found." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `counsellor:${raw.counsellorId}/languages`,
    reason: "update_spoken_languages",
  });
  revalidatePath("/hub/team");
  return { ok: true };
}

/* ---- Full profile editing (batch 2i) - the org edits everything ---- */

const profileInput = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the member's full name.").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  languages: z.array(z.string().trim().min(1).max(40)).max(12),
  qualifications: z.array(z.object({
    qualification: z.string().trim().min(2, "Name each qualification.").max(120),
    institution: z.string().trim().max(120),
    year: z.number().int().min(1950).max(2100),
  })).max(12),
  specialties: z.array(z.string().trim().min(1).max(60)).max(16),
  credential: z.object({
    body: z.enum(["HPCSA", "ASCHP", "SACSSP"]),
    registrationNo: z.string().trim().max(60).optional().or(z.literal("")),
  }).nullable().optional(),
});

/**
 * The org updates a member's whole profile - name, contact, bio, education,
 * specialties, and (counsellors) the credential. Changing the credential body
 * or registration number resets verification to pending, honestly. Audited.
 */
export async function saveMemberProfile(
  raw: z.infer<typeof profileInput>,
): Promise<{ ok: true; credentialReset: boolean } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the profile details." };
  const d = parsed.data;

  let credentialReset = false;
  if (isDb()) {
    const { saveMemberProfileDb } = await import("@/db/queries/team");
    const res = await saveMemberProfileDb(membership.orgId, d.userId, {
      name: d.name,
      phone: d.phone || null,
      dateOfBirth: d.dateOfBirth || null,
      address: d.address || null,
      bio: d.bio || null,
      languages: d.languages,
      qualifications: d.qualifications,
      specialties: d.specialties,
      credential: d.credential ? { body: d.credential.body, registrationNo: d.credential.registrationNo || null } : null,
    });
    if (!res.ok) return { ok: false, error: "That member couldn't be found." };
    credentialReset = res.credentialReset;
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:${d.userId}/profile`,
    reason: credentialReset ? "update_member_profile_credential_reset" : "update_member_profile",
  });
  revalidatePath(`/hub/team/${d.userId}`);
  revalidatePath("/hub/team");
  return { ok: true, credentialReset };
}
