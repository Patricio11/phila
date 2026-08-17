import "server-only";
import type { VoiceAdapter, VoiceConfig, VoiceLegStatus } from "@/lib/voice/adapter";
import { twilioAdapter } from "@/lib/voice/twilio";

/**
 * Phase 33.2/33.3 - the VoicePhila rail. Config lives with the other platform
 * integrations (key "voice", credentials encrypted); the adapter is chosen by
 * mode: `mock` for dev (deterministic, no carrier), `live` for Twilio.
 * Dormant by default - no org surface appears until the rail is on.
 */

export async function getVoiceConfig(): Promise<VoiceConfig | null> {
  const { getPlatformIntegration } = await import("@/db/queries/platform-integrations");
  const it = await getPlatformIntegration("voice");
  if (!it || !it.enabled) return null;
  const mode = it.creds.mode === "live" ? "live" : it.creds.mode === "mock" ? "mock" : "off";
  if (mode === "off") return null;
  return {
    provider: "twilio",
    mode,
    accountSid: it.creds.accountSid ?? "",
    authToken: it.creds.authToken ?? "",
    callerNumber: it.creds.callerNumber ?? "",
  };
}

export async function voiceConfigured(): Promise<boolean> {
  return Boolean(await getVoiceConfig());
}

/** Deterministic dev adapter: no carrier, no network - but the same shape. */
export function mockAdapter(cfg: VoiceConfig): VoiceAdapter {
  return {
    async placeBridgedCall() {
      return { ok: true, callId: `mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}` };
    },
    parseWebhook(req) {
      // Mock webhooks authenticate with the auth token verbatim - dev only.
      if (req.signature !== cfg.authToken) return { ok: false, error: "bad mock secret" };
      const callId = req.params.CallSid ?? "";
      if (!callId.startsWith("mock_")) return { ok: false, error: "not a mock call" };
      return {
        ok: true,
        callId,
        status: (req.params.CallStatus as VoiceLegStatus) ?? "completed",
        durationSec: Number(req.params.CallDuration ?? 0) || 0,
      };
    },
    async testConnection() {
      return { ok: true, detail: "Mock mode - calls simulate instantly, nothing dials out." };
    },
  };
}

export function adapterFor(cfg: VoiceConfig): VoiceAdapter {
  return cfg.mode === "mock" ? mockAdapter(cfg) : twilioAdapter(cfg);
}
