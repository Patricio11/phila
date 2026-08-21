/**
 * Phase 33.9 - the VoicePhila provider switchboard, pure and unit-tested.
 *
 * Many providers may be CONFIGURED; exactly ONE is ACTIVE. Mock is a
 * first-class provider (the dev/dry-run carrier), so the whole rail has one
 * rule instead of per-card modes: off = nothing active; on = mock, Twilio or
 * Africa's Talking. A provider cannot be made active until its Test passed
 * (mock always passes - it has nothing to test). Switching providers applies
 * to NEW calls only - every leg records its provider, and each provider's
 * webhook settles its own legs whatever is active now.
 */

export const VOICE_PROVIDERS = ["mock", "twilio", "africastalking"] as const;
export type VoiceProviderName = (typeof VOICE_PROVIDERS)[number];

export const VOICE_PROVIDER_LABELS: Record<VoiceProviderName, string> = {
  mock: "Mock (dry run)",
  twilio: "Twilio",
  africastalking: "Africa's Talking",
};

/** Everything the switchboard knows, decoded from the flat encrypted creds. */
export interface Switchboard {
  /** Exactly one active provider, or null = the rail is off. */
  active: VoiceProviderName | null;
  twilio: { accountSid: string; authToken: string; callerNumber: string; tested: boolean };
  at: { username: string; apiKey: string; callerNumber: string; tested: boolean; webhookToken: string };
}

/**
 * Decode the stored creds (flat string map). Understands BOTH shapes:
 * the 33.9 switchboard shape, and the legacy 33.2 single-Twilio shape
 * (`{provider:"twilio", mode, accountSid, ...}`) which it migrates on read -
 * a live Twilio setup stays live across the upgrade without anyone touching it.
 */
export function decodeSwitchboard(creds: Record<string, string>, enabled: boolean): Switchboard {
  // Legacy shape: no `active` key, old `mode` present.
  if (!("active" in creds) && ("mode" in creds || "accountSid" in creds)) {
    const mode = creds.mode ?? "off";
    const active: VoiceProviderName | null = !enabled || mode === "off" ? null : mode === "mock" ? "mock" : "twilio";
    return {
      active,
      twilio: {
        accountSid: creds.accountSid ?? "",
        authToken: creds.authToken ?? "",
        callerNumber: creds.callerNumber ?? "",
        // A legacy LIVE config was necessarily working - honour it as tested.
        tested: mode === "live" && Boolean(creds.accountSid && creds.authToken),
      },
      at: { username: "", apiKey: "", callerNumber: "", tested: false, webhookToken: "" },
    };
  }
  const active = VOICE_PROVIDERS.includes(creds.active as VoiceProviderName) && enabled
    ? (creds.active as VoiceProviderName)
    : null;
  return {
    active,
    twilio: {
      accountSid: creds.tw_accountSid ?? "",
      authToken: creds.tw_authToken ?? "",
      callerNumber: creds.tw_callerNumber ?? "",
      tested: creds.tw_tested === "1",
    },
    at: {
      username: creds.at_username ?? "",
      apiKey: creds.at_apiKey ?? "",
      callerNumber: creds.at_callerNumber ?? "",
      tested: creds.at_tested === "1",
      webhookToken: creds.at_webhookToken ?? "",
    },
  };
}

/** Encode back to the flat string map the integrations store holds. */
export function encodeSwitchboard(sb: Switchboard): Record<string, string> {
  return {
    active: sb.active ?? "",
    tw_accountSid: sb.twilio.accountSid,
    tw_authToken: sb.twilio.authToken,
    tw_callerNumber: sb.twilio.callerNumber,
    tw_tested: sb.twilio.tested ? "1" : "",
    at_username: sb.at.username,
    at_apiKey: sb.at.apiKey,
    at_callerNumber: sb.at.callerNumber,
    at_tested: sb.at.tested ? "1" : "",
    at_webhookToken: sb.at.webhookToken,
  };
}

/** Is a provider configured enough to even try a test? */
export function providerConfigured(sb: Switchboard, p: VoiceProviderName): boolean {
  if (p === "mock") return true;
  if (p === "twilio") return Boolean(sb.twilio.accountSid && sb.twilio.authToken && sb.twilio.callerNumber);
  return Boolean(sb.at.username && sb.at.apiKey && sb.at.callerNumber);
}

/**
 * The one guarded rule of the switchboard: a provider may only become active
 * once its Test has passed (mock is always allowed). Returns the honest reason
 * when it may not.
 */
export function canActivate(sb: Switchboard, p: VoiceProviderName): { ok: true } | { ok: false; reason: string } {
  if (p === "mock") return { ok: true };
  if (!providerConfigured(sb, p)) return { ok: false, reason: `${VOICE_PROVIDER_LABELS[p]} isn't fully configured yet.` };
  const tested = p === "twilio" ? sb.twilio.tested : sb.at.tested;
  if (!tested) return { ok: false, reason: `Run ${VOICE_PROVIDER_LABELS[p]}'s Test first - a provider can't go live untested.` };
  return { ok: true };
}

/** The active caller number (what both parties see). */
export function activeCallerNumber(sb: Switchboard): string {
  if (sb.active === "twilio") return sb.twilio.callerNumber;
  if (sb.active === "africastalking") return sb.at.callerNumber;
  return "+27000000000"; // mock - never dialled
}
