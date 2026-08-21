import "server-only";
import type { VoiceAdapter, VoiceLegStatus } from "@/lib/voice/adapter";
import { decodeSwitchboard, activeCallerNumber, type Switchboard, type VoiceProviderName } from "@/lib/voice/switchboard";
import { twilioAdapter } from "@/lib/voice/twilio";
import { africastalkingAdapter } from "@/lib/voice/africastalking";

/**
 * Phase 33.2/33.3 → 33.9 - the VoicePhila rail. Config lives with the other
 * platform integrations (key "voice", credentials encrypted). 33.9 turned the
 * single-Twilio config into a SWITCHBOARD: many providers configured, exactly
 * one active (mock is a first-class provider). Dormant by default - no org
 * surface appears until a provider is active. Legacy 33.2 configs are decoded
 * transparently, so a live Twilio setup survives the upgrade untouched.
 */

export async function getSwitchboard(): Promise<Switchboard> {
  const { getPlatformIntegration } = await import("@/db/queries/platform-integrations");
  const it = await getPlatformIntegration("voice");
  return decodeSwitchboard(it?.creds ?? {}, Boolean(it?.enabled));
}

/** The ACTIVE provider's calling surface, or null when the rail is off. */
export async function getActiveVoice(): Promise<{ provider: VoiceProviderName; callerNumber: string; adapter: VoiceAdapter } | null> {
  const sb = await getSwitchboard();
  if (!sb.active) return null;
  return { provider: sb.active, callerNumber: activeCallerNumber(sb), adapter: adapterForProvider(sb, sb.active) };
}

export async function voiceConfigured(): Promise<boolean> {
  return Boolean((await getSwitchboard()).active);
}

/** An adapter for a NAMED provider (webhooks settle their own legs whatever is active). */
export function adapterForProvider(sb: Switchboard, provider: VoiceProviderName): VoiceAdapter {
  if (provider === "twilio") {
    return twilioAdapter({ provider: "twilio", mode: "live", accountSid: sb.twilio.accountSid, authToken: sb.twilio.authToken, callerNumber: sb.twilio.callerNumber });
  }
  if (provider === "africastalking") {
    return africastalkingAdapter({ username: sb.at.username, apiKey: sb.at.apiKey, callerNumber: sb.at.callerNumber });
  }
  return mockAdapter(sb);
}

/** Deterministic dev adapter: no carrier, no network - but the same shape. */
export function mockAdapter(sb: Switchboard): VoiceAdapter {
  // Mock webhooks authenticate with the Twilio auth token verbatim (dev only),
  // or the literal "mock-secret" when nothing is configured at all.
  const secret = sb.twilio.authToken || "mock-secret";
  return {
    async placeBridgedCall() {
      return { ok: true, callId: `mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}` };
    },
    parseWebhook(req) {
      if (req.signature !== secret) return { ok: false, error: "bad mock secret" };
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
      return { ok: true, detail: "Mock - calls simulate instantly, nothing dials out." };
    },
  };
}
