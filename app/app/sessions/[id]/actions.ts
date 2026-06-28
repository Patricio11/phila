"use server";

import { z } from "zod";
import { logAccess } from "@/lib/audit";
import { APPOINTMENT_STATES } from "@/lib/domain/enums";
import { now as clockNow } from "@/lib/clock";

/**
 * Session-editor actions. In Part A they validate + audit and return success
 * without persisting (Mock-First); Phase 10/14 wire real persistence + the real
 * AI scribe behind the same shapes. The AI never signs, never sends, never
 * advances clinical state  it only returns a labelled draft (AI-Honesty Rule).
 */

const idInput = z.object({ appointmentId: z.string().min(1) });

/** The structured fields the scribe extracts  these feed funder reporting (zero double entry). */
export interface AiExtraction {
  presentingIssue: string;
  risk: string;
  outcome: string;
  referral: string;
}

export async function generateAiDraft(
  raw: z.infer<typeof idInput>,
): Promise<{ ok: true; draft: string; extraction: AiExtraction } | { ok: false; error: string }> {
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  await logAccess({
    action: "admin.action",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
    target: `appointment:${parsed.data.appointmentId}/ai_draft`,
    reason: "ai_note_draft",
  });

  // Mock draft  non-diagnostic, never names a method. The counsellor edits + signs.
  const draft = [
    "Presenting concern: client described feeling stretched between work and home, with low energy in the mornings.",
    "Session: explored what's been hardest this week; reflected on small routines that already help. Client engaged and open.",
    "Risk: nothing of concern raised today.",
    "Plan: continue weekly. Review the morning wind-down routine next session and adjust together.",
  ].join("\n\n");

  const extraction: AiExtraction = {
    presentingIssue: "Work–life stress, low morning energy",
    risk: "None raised today",
    outcome: "Engaged; routine helping",
    referral: "None",
  };

  return { ok: true, draft, extraction };
}

const signInput = z.object({
  appointmentId: z.string().min(1),
  body: z.string().min(1, "Write or generate a note before signing."),
});

export async function signNote(
  raw: z.infer<typeof signInput>,
): Promise<{ ok: true; signedAt: string } | { ok: false; error: string }> {
  const parsed = signInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Cannot sign" };

  const signedAt = clockNow();
  await logAccess({
    action: "note.read",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
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
  const parsed = progressInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid state" };
  await logAccess({
    action: "admin.action",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
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
  const parsed = careInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Cannot share" };
  // Sharing is an explicit, consented action  the private note is never exposed.
  await logAccess({
    action: "admin.action",
    actor: { userId: "counsellor", platformRole: null, teamRole: "counsellor" },
    orgId: null,
    target: `client:${parsed.data.clientId}/care_plan`,
    reason: "share_care_plan",
  });
  return { ok: true };
}
