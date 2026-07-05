"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { logAccess } from "@/lib/audit";
import { requireOrg } from "@/lib/auth/guard";
import { APPOINTMENT_STATES } from "@/lib/domain/enums";
import { now as clockNow } from "@/lib/clock";
import { setAppointmentState } from "@/db/queries/appointments";
import { notifyAppointment } from "@/lib/messaging/notify";
import { getDb } from "@/db/client";
import { appointments, clients } from "@/db/schema";
import { getAiSettings, getAiSpendThisMonth, recordAiUsage } from "@/db/queries/ai";
import { draftNote, draftCarePlan } from "@/lib/ai/scribe";

/** Who may run the session editor / AI scribe: the counsellor or the org admin. */
const CLINICIANS = ["counsellor", "org_admin"] as const;

/**
 * Resolve the client name for an appointment **within the caller's org**, and gate
 * the AI scribe. Scoping the lookup by `orgId` means a caller can never resolve a
 * client name (or spend the AI budget) for another org's appointment.
 */
async function aiContext(orgId: string, appointmentId: string): Promise<{ ok: true; clientName: string } | { ok: false; error: string }> {
  const [row] = await getDb()
    .select({ clientName: clients.name })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)))
    .limit(1);
  if (!row) return { ok: false, error: "Session not found." };
  const ai = await getAiSettings(orgId);
  if (!ai.aiEnabled) return { ok: false, error: "Turn on the AI scribe in Settings first  it needs cross-border processing consent (POPIA)." };
  if ((await getAiSpendThisMonth(orgId)) >= ai.monthlyCapCents) return { ok: false, error: "This month's AI budget is used up. Raise the cap in Settings to continue." };
  return { ok: true, clientName: row.clientName ?? "" };
}

/**
 * Session-editor actions. In Part A they validate + audit and return success
 * without persisting (Mock-First); Phase 10/14 wire real persistence + the real
 * AI scribe behind the same shapes. The AI never signs, never sends, never
 * advances clinical state  it only returns a labelled draft (AI-Honesty Rule).
 */

/** The structured fields the scribe extracts  these feed funder reporting (zero double entry). */
export interface AiExtraction {
  presentingIssue: string;
  risk: string;
  outcome: string;
  referral: string;
}

const draftInput = z.object({ appointmentId: z.string().min(1), cues: z.string().trim().max(4000) });

export async function generateAiDraft(
  raw: z.infer<typeof draftInput>,
): Promise<{ ok: true; draft: string; extraction: AiExtraction } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...CLINICIANS]);
  const parsed = draftInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (parsed.data.cues.length < 8) return { ok: false, error: "Jot a few cues in the note first  I'll shape them into a draft you can edit and sign." };

  const ctx = await aiContext(membership.orgId, parsed.data.appointmentId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const result = await draftNote({ cues: parsed.data.cues, clientNames: [ctx.clientName] });
  if (!result.ok || !result.draft || !result.extraction) return { ok: false, error: result.error ?? "The AI draft didn't come back  try again." };

  if (result.usage && result.model) {
    await recordAiUsage({ orgId: membership.orgId, kind: "note", model: result.model, ...result.usage });
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}/ai_draft`,
    reason: "ai_note_draft",
  });
  return { ok: true, draft: result.draft, extraction: result.extraction };
}

/** AI draft of the CLIENT-FACING care-plan summary (plain language; counsellor edits + shares; never auto-sent). */
export async function generateCarePlanDraft(
  raw: z.infer<typeof draftInput>,
): Promise<{ ok: true; carePlan: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...CLINICIANS]);
  const parsed = draftInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (parsed.data.cues.length < 8) return { ok: false, error: "Add a couple of session cues first." };

  const ctx = await aiContext(membership.orgId, parsed.data.appointmentId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const result = await draftCarePlan({ cues: parsed.data.cues, clientNames: [ctx.clientName] });
  if (!result.ok || !result.carePlan) return { ok: false, error: result.error ?? "The AI draft didn't come back  try again." };

  if (result.usage && result.model) {
    await recordAiUsage({ orgId: membership.orgId, kind: "care_plan", model: result.model, ...result.usage });
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `appointment:${parsed.data.appointmentId}/ai_careplan`, reason: "ai_careplan_draft" });
  return { ok: true, carePlan: result.carePlan };
}

const signInput = z.object({
  appointmentId: z.string().min(1),
  body: z.string().min(1, "Write or generate a note before signing."),
});

export async function signNote(
  raw: z.infer<typeof signInput>,
): Promise<{ ok: true; signedAt: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...CLINICIANS]);
  const parsed = signInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Cannot sign" };

  const signedAt = clockNow();
  await logAccess({
    action: "note.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}/note`,
    reason: "sign_note",
  });
  return { ok: true, signedAt };
}

const progressInput = z.object({
  appointmentId: z.string().min(1),
  state: z.enum(APPOINTMENT_STATES),
});

export async function markProgress(
  raw: z.infer<typeof progressInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...CLINICIANS]);
  const parsed = progressInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid state" };
  if (process.env.DATA_PROVIDER === "db") {
    const changed = await setAppointmentState(membership.orgId, parsed.data.appointmentId, parsed.data.state);
    if (changed === 0) return { ok: false, error: "That session couldn't be found." };
    if (parsed.data.state === "no_show") await notifyAppointment(parsed.data.appointmentId, "no_show");
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${parsed.data.appointmentId}`,
    reason: `mark_${parsed.data.state}`,
  });
  return { ok: true };
}

const careInput = z.object({
  clientId: z.string().min(1),
  summary: z.string().min(1, "Add something to share before sharing."),
});

export async function shareCarePlan(
  raw: z.infer<typeof careInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...CLINICIANS]);
  const parsed = careInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Cannot share" };
  // Sharing is an explicit, consented action  the private note is never exposed.
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}/care_plan`,
    reason: "share_care_plan",
  });
  return { ok: true };
}
