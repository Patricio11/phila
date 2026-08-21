"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { logAccess } from "@/lib/audit";
import { requireOrg } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import { appointments, clients, counsellors, teamProfiles, voiceCallLegs } from "@/db/schema";
import { legsForAppointmentDb, legActive, type VoiceLegView } from "@/db/queries/voice";
import { getCreditBalances } from "@/db/queries/messaging";
import { getActiveVoice, voiceConfigured } from "@/lib/voice";
import { toE164 } from "@/lib/voice/phone";

/**
 * Phase 33.4/33.7 - the bridged call engine. "Call client" dials the
 * session's COUNSELLOR first; on answer the platform dials the client and
 * bridges them - both sides see only the shared platform number. Every
 * attempt is its own leg; the webhook writes the carrier's authoritative
 * duration and bills it. Who may call: the clinicians (same as marking a
 * session held by phone).
 */
const CALLERS = ["counsellor", "org_admin"] as const;

export interface CallPanelState {
  /** The rail is on for the platform (mock or live). Off = no panel at all. */
  railOn: boolean;
  /** null = a call can be placed; otherwise the honest reason it can't. */
  blocked: string | null;
  /** The org's minute balance - shown to org admins only (they do the
   *  topping up); a counsellor just sees the call button. */
  balanceMin: number | null;
  legs: VoiceLegView[];
  /** Sum of connected seconds across completed legs - the session's total. */
  totalSec: number;
  /** An attempt currently in flight (initiated/ringing/answered). */
  activeLegId: string | null;
}

async function panelState(orgId: string, appointmentId: string, isAdmin: boolean): Promise<CallPanelState> {
  if (!(await voiceConfigured())) return { railOn: false, blocked: "Voice calls aren't switched on.", balanceMin: null, legs: [], totalSec: 0, activeLegId: null };

  const db = getDb();
  const [appt] = await db.select({ id: appointments.id, clientId: appointments.clientId, counsellorId: appointments.counsellorId })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)))
    .limit(1);
  if (!appt) return { railOn: true, blocked: "Session not found.", balanceMin: null, legs: [], totalSec: 0, activeLegId: null };

  const [legs, balances, [client], [couns]] = await Promise.all([
    legsForAppointmentDb(orgId, appointmentId),
    getCreditBalances(orgId),
    db.select({ phone: clients.phone }).from(clients).where(and(eq(clients.id, appt.clientId), eq(clients.orgId, orgId))).limit(1),
    db.select({ userId: counsellors.userId }).from(counsellors).where(and(eq(counsellors.id, appt.counsellorId), eq(counsellors.orgId, orgId))).limit(1),
  ]);

  const active = legs.find((l) => legActive(l.status));
  let blocked: string | null = null;
  if (!toE164(client?.phone)) blocked = "The client has no dialable phone number on file.";
  else if (balances.voice < 1) blocked = isAdmin
    ? "This practice is out of call minutes - top up under Billing & usage."
    : "This practice is out of call minutes - ask your practice admin to top up.";
  else if (couns) {
    const [profile] = await db.select({ phone: teamProfiles.phone }).from(teamProfiles)
      .where(and(eq(teamProfiles.orgId, orgId), eq(teamProfiles.userId, couns.userId))).limit(1);
    if (!toE164(profile?.phone)) blocked = "The counsellor has no phone number on their profile.";
  } else blocked = "The session's counsellor wasn't found.";

  return {
    railOn: true,
    blocked,
    balanceMin: isAdmin ? balances.voice : null,
    legs,
    totalSec: legs.filter((l) => l.status === "completed").reduce((s, l) => s + l.durationSec, 0),
    activeLegId: active?.id ?? null,
  };
}

/** The panel's state - fetched on open and while a call is in flight. */
export async function getCallPanel(
  raw: { appointmentId: string },
): Promise<{ ok: true; state: CallPanelState } | { ok: false; error: string }> {
  const { membership } = await requireOrg([...CALLERS]);
  const parsed = z.object({ appointmentId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  return { ok: true, state: await panelState(membership.orgId, parsed.data.appointmentId, membership.teamRole === "org_admin") };
}

/**
 * Place (or re-place, after a drop) the bridged call. Honest hard stop: no
 * dialable numbers or a zero balance refuses BEFORE anything rings - never a
 * broken call. One attempt at a time per session.
 */
export async function startClientCall(
  raw: { appointmentId: string },
): Promise<{ ok: true; state: CallPanelState } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...CALLERS]);
  const parsed = z.object({ appointmentId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const appointmentId = parsed.data.appointmentId;

  const voice = await getActiveVoice();
  if (!voice) return { ok: false, error: "Voice calls aren't switched on." };

  const db = getDb();
  const [appt] = await db.select({ id: appointments.id, clientId: appointments.clientId, counsellorId: appointments.counsellorId })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, membership.orgId)))
    .limit(1);
  if (!appt) return { ok: false, error: "Session not found." };

  // One in-flight attempt per session - redial only after the last one ends.
  const legs = await legsForAppointmentDb(membership.orgId, appointmentId);
  if (legs.some((l) => legActive(l.status))) return { ok: false, error: "A call for this session is already in progress." };

  const [client] = await db.select({ phone: clients.phone }).from(clients)
    .where(and(eq(clients.id, appt.clientId), eq(clients.orgId, membership.orgId))).limit(1);
  const clientNumber = toE164(client?.phone);
  if (!clientNumber) return { ok: false, error: "The client has no dialable phone number on file." };

  const [couns] = await db.select({ userId: counsellors.userId }).from(counsellors)
    .where(and(eq(counsellors.id, appt.counsellorId), eq(counsellors.orgId, membership.orgId))).limit(1);
  if (!couns) return { ok: false, error: "The session's counsellor wasn't found." };
  const [profile] = await db.select({ phone: teamProfiles.phone }).from(teamProfiles)
    .where(and(eq(teamProfiles.orgId, membership.orgId), eq(teamProfiles.userId, couns.userId))).limit(1);
  const counsellorNumber = toE164(profile?.phone);
  if (!counsellorNumber) return { ok: false, error: "The counsellor has no phone number on their profile." };

  // The hard stop (33.5): a call won't place on an empty balance.
  const balances = await getCreditBalances(membership.orgId);
  if (balances.voice < 1) return {
    ok: false,
    error: membership.teamRole === "org_admin"
      ? "This practice is out of call minutes - top up under Billing & usage."
      : "This practice is out of call minutes - ask your practice admin to top up.",
  };

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const placed = await voice.adapter.placeBridgedCall({
    counsellorNumber,
    clientNumber,
    callerNumber: voice.callerNumber,
    statusCallbackUrl: `${base}/api/webhooks/voice`,
    ref: { orgId: membership.orgId, appointmentId },
  });
  if (!placed.ok) return { ok: false, error: placed.error };

  await db.insert(voiceCallLegs).values({
    id: placed.callId,
    orgId: membership.orgId,
    appointmentId,
    placedBy: principal.userId,
    // 33.9 - the leg remembers its carrier; AT bridges from the number-level
    // callback, so it also carries the client number until the call ends.
    provider: voice.provider,
    bridgeTo: voice.provider === "africastalking" ? clientNumber : null,
    status: "initiated",
  });
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `voice_leg:${placed.callId}`,
    reason: "voice_call_placed",
  });

  return { ok: true, state: await panelState(membership.orgId, appointmentId, membership.teamRole === "org_admin") };
}
