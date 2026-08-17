import { createHmac } from "node:crypto";
import type { PlaceCallInput, VoiceAdapter, VoiceConfig, VoiceLegStatus } from "@/lib/voice/adapter";

/**
 * Phase 33.3 - the Twilio implementation. A bridged call is one Twilio call
 * to the COUNSELLOR whose TwiML dials the CLIENT; both legs show the shared
 * platform number. Status callbacks land on our webhook with the carrier's
 * authoritative duration. No recording is ever requested.
 */

const API = "https://api.twilio.com/2010-04-01";

/** Twilio's status vocabulary -> ours. */
function mapStatus(s: string): VoiceLegStatus {
  switch (s) {
    case "queued": case "initiated": return "initiated";
    case "ringing": return "ringing";
    case "in-progress": return "answered";
    case "completed": return "completed";
    case "busy": return "busy";
    case "no-answer": return "no_answer";
    case "canceled": return "canceled";
    default: return "failed";
  }
}

/**
 * Twilio request signature (X-Twilio-Signature): base64 HMAC-SHA1 over the
 * full URL + the POST params sorted by key, appended name+value. Pure - unit
 * tested against a known vector.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function twilioAdapter(cfg: VoiceConfig): VoiceAdapter {
  const auth = "Basic " + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
  return {
    async placeBridgedCall(input: PlaceCallInput) {
      // TwiML: when the counsellor answers, dial the client; the shared number
      // is the caller id both ways (masking). Status callbacks per lifecycle.
      const twiml = `<Response><Dial callerId="${input.callerNumber}" answerOnBridge="true"><Number>${input.clientNumber}</Number></Dial></Response>`;
      const body = new URLSearchParams({
        To: input.counsellorNumber,
        From: input.callerNumber,
        Twiml: twiml,
        StatusCallback: input.statusCallbackUrl,
        StatusCallbackEvent: "initiated ringing answered completed",
      });
      try {
        const res = await fetch(`${API}/Accounts/${cfg.accountSid}/Calls.json`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (!res.ok || !data.sid) return { ok: false, error: data.message ?? `Twilio refused the call (${res.status}).` };
        return { ok: true, callId: data.sid };
      } catch {
        return { ok: false, error: "Couldn't reach Twilio - try again." };
      }
    },

    parseWebhook(req) {
      if (!req.signature) return { ok: false, error: "missing signature" };
      const expected = twilioSignature(cfg.authToken, req.url, req.params);
      if (expected !== req.signature) return { ok: false, error: "bad signature" };
      const callId = req.params.CallSid ?? "";
      if (!callId) return { ok: false, error: "no CallSid" };
      return {
        ok: true,
        callId,
        status: mapStatus(req.params.CallStatus ?? ""),
        durationSec: Number(req.params.CallDuration ?? 0) || 0,
      };
    },

    async testConnection() {
      try {
        const res = await fetch(`${API}/Accounts/${cfg.accountSid}.json`, {
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return { ok: true, detail: "Twilio account reachable - credentials look right." };
        return { ok: false, detail: res.status === 401 ? "Twilio rejected the credentials." : `Twilio answered ${res.status}.` };
      } catch {
        return { ok: false, detail: "Couldn't reach Twilio." };
      }
    },
  };
}
