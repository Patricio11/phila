import type { PlaceCallInput, VoiceAdapter, VoiceLegStatus } from "@/lib/voice/adapter";

/**
 * Phase 33.9b - the Africa's Talking implementation of the VoicePhila seam.
 *
 * Same bridged shape as Twilio: one call to the COUNSELLOR; when they answer,
 * AT hits the number's callback URL and our XML answer dials the CLIENT with
 * the shared number as caller id. Differences, handled here:
 *  - Auth is username + apiKey (header), not SID/token basic auth.
 *  - AT does NOT sign callbacks: authenticity is a secret token in the
 *    callback URL path (`/api/webhooks/voice-at/<token>`), plus the rule that
 *    only legs WE placed are ever acted on.
 *  - The callback URL is configured per NUMBER in the AT dashboard, not per
 *    call - so the leg carries the client number to dial (voice_call_legs.bridge_to).
 *  - `username: "sandbox"` routes to AT's sandbox hosts, which is exactly how
 *    the 33.9c SA validation checklist is run through Phila itself.
 * No recording is ever requested.
 */

export interface AtConfig { username: string; apiKey: string; callerNumber: string }

const hosts = (username: string) =>
  username === "sandbox"
    ? { voice: "https://voice.sandbox.africastalking.com", api: "https://api.sandbox.africastalking.com" }
    : { voice: "https://voice.africastalking.com", api: "https://api.africastalking.com" };

/** AT's final-notification vocabulary -> ours. Pure, unit-tested. */
export function mapAtStatus(params: Record<string, string>): VoiceLegStatus {
  const state = (params.callSessionState ?? "").toLowerCase();
  const status = (params.status ?? "").toLowerCase().replace(/\s+/g, "_");
  if (state === "ringing" || status === "ringing") return "ringing";
  if (state === "active" || params.isActive === "1") return "answered";
  if (state === "completed" || status === "success" || status === "completed") return "completed";
  if (status === "no_answer" || status === "not_answered") return "no_answer";
  if (status === "busy") return "busy";
  if (status === "aborted" || status === "canceled" || status === "cancelled") return "canceled";
  return "failed";
}

/** The bridge answer: dial the client, wear the shared number, hard-cap runaways. */
export function atDialXml(clientNumber: string, callerNumber: string, maxDurationSec = 3600): string {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial phoneNumbers="${esc(clientNumber)}" callerId="${esc(callerNumber)}" maxDuration="${maxDurationSec}" record="false"/></Response>`;
}

export function africastalkingAdapter(cfg: AtConfig): VoiceAdapter {
  const h = hosts(cfg.username);
  return {
    async placeBridgedCall(input: PlaceCallInput) {
      const body = new URLSearchParams({
        username: cfg.username,
        from: input.callerNumber,
        to: input.counsellorNumber,
      });
      try {
        const res = await fetch(`${h.voice}/call`, {
          method: "POST",
          headers: { apiKey: cfg.apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        const data = (await res.json().catch(() => ({}))) as { entries?: { sessionId?: string; status?: string }[]; errorMessage?: string };
        const entry = data.entries?.[0];
        if (!res.ok || !entry?.sessionId || (entry.status && !/queued/i.test(entry.status))) {
          return { ok: false, error: data.errorMessage ?? entry?.status ?? `Africa's Talking refused the call (${res.status}).` };
        }
        return { ok: true, callId: entry.sessionId };
      } catch {
        return { ok: false, error: "Couldn't reach Africa's Talking - try again." };
      }
    },

    parseWebhook(req) {
      // Authenticity is the token in the URL path - the ROUTE verifies it
      // before this runs; `signature` carries the verdict ("token-ok").
      if (req.signature !== "token-ok") return { ok: false, error: "bad callback token" };
      const callId = req.params.sessionId ?? "";
      if (!callId) return { ok: false, error: "no sessionId" };
      return {
        ok: true,
        callId,
        status: mapAtStatus(req.params),
        durationSec: Number(req.params.durationInSeconds ?? 0) || 0,
      };
    },

    async testConnection() {
      // The cheap authenticated read: the account's user data (also shows the
      // wallet currency - the 33.9c "can we be billed in ZAR?" signal).
      try {
        const res = await fetch(`${h.api}/version1/user?username=${encodeURIComponent(cfg.username)}`, {
          headers: { apiKey: cfg.apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          return { ok: false, detail: res.status === 401 || res.status === 403 ? "Africa's Talking rejected the credentials." : `Africa's Talking answered ${res.status}.` };
        }
        const data = (await res.json().catch(() => ({}))) as { UserData?: { balance?: string } };
        const balance = data.UserData?.balance;
        return {
          ok: true,
          detail: balance
            ? `Africa's Talking account reachable - balance ${balance}${balance.trim().startsWith("ZAR") ? " (billed in ZAR)" : ""}.`
            : "Africa's Talking account reachable - credentials look right.",
        };
      } catch {
        return { ok: false, detail: "Couldn't reach Africa's Talking." };
      }
    },
  };
}
