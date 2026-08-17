/**
 * Phase 33.3 - the VoicePhila adapter seam. The platform bridges a call
 * (dial the counsellor, then the client, connect them on the shared number)
 * and the provider reports the authoritative timings to our webhook. Twilio
 * is the first implementation; the interface is deliberately small so
 * Africa's Talking / Telnyx / others slot in later and the super-admin just
 * switches provider - no UI change (same pattern as the storage backend).
 */

export interface PlaceCallInput {
  /** E.164 numbers. The counsellor is dialled first; on answer, the client. */
  counsellorNumber: string;
  clientNumber: string;
  /** The shared platform caller id both parties see (number masking). */
  callerNumber: string;
  /** Our webhook URL for status callbacks. */
  statusCallbackUrl: string;
  /** Rides along so the webhook can attribute the leg. */
  ref: { orgId: string; appointmentId: string };
}

export type VoiceLegStatus =
  | "initiated" | "ringing" | "answered" | "completed" | "failed" | "no_answer" | "busy" | "canceled";

export interface VoiceAdapter {
  /** Start a bridged call. Returns the provider's call id - our leg id. */
  placeBridgedCall(input: PlaceCallInput): Promise<{ ok: true; callId: string } | { ok: false; error: string }>;
  /** Verify + parse a webhook request into a normalised event. */
  parseWebhook(req: { url: string; params: Record<string, string>; signature: string | null }):
    | { ok: true; callId: string; status: VoiceLegStatus; durationSec: number }
    | { ok: false; error: string };
  /** Cheap credentials check for the admin Test button. */
  testConnection(): Promise<{ ok: boolean; detail: string }>;
}

export interface VoiceConfig {
  provider: "twilio";
  mode: "off" | "mock" | "live";
  accountSid: string;
  authToken: string;
  callerNumber: string;
}
