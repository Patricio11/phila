import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { getPlatformIntegration } from "@/db/queries/platform-integrations";

/**
 * LiveKit server helpers (Phase 13 · admin-managed in Phase 17.1). Tokens are minted
 * server-side so the API secret never reaches the browser; the client only gets a
 * short-lived JWT + the ws URL, scoped to ONE room. The config (Demo self-host or Live
 * Cloud) is configured + switched on by the super-admin in /admin/integrations
 * (encrypted at rest)  NOT env vars. See docs/LIVEKIT_SETUP.md.
 */
export type LivekitProvider = "selfhosted" | "cloud";

export interface LivekitConfig {
  /** Which server the tokens/URL point at. Both use the identical SDK + protocol. */
  provider: LivekitProvider;
  /** Legacy alias kept for callers/logs: selfhosted → "demo", cloud → "live". */
  mode: "demo" | "live";
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * The active provider's credential set from the stored creds. Both providers are
 * stored side-by-side (sh_* = Phila self-hosted, cloud_* = LiveKit Cloud) so the
 * switch is a real toggle, not a re-entry. Falls back to the legacy flat keys so an
 * older single-set config keeps working.
 */
export function activeLivekitCreds(creds: Record<string, string>): { provider: LivekitProvider; wsUrl: string; apiKey: string; apiSecret: string } {
  const provider: LivekitProvider =
    creds.provider === "cloud" ? "cloud" : creds.provider === "selfhosted" ? "selfhosted" : creds.mode === "live" ? "cloud" : "selfhosted";
  const legacyMatches = (creds.mode === "live" ? "cloud" : "selfhosted") === provider;
  const pick = provider === "cloud"
    ? { wsUrl: creds.cloud_wsUrl, apiKey: creds.cloud_apiKey, apiSecret: creds.cloud_apiSecret }
    : { wsUrl: creds.sh_wsUrl, apiKey: creds.sh_apiKey, apiSecret: creds.sh_apiSecret };
  return {
    provider,
    wsUrl: pick.wsUrl || (legacyMatches ? creds.wsUrl : "") || "",
    apiKey: pick.apiKey || (legacyMatches ? creds.apiKey : "") || "",
    apiSecret: pick.apiSecret || (legacyMatches ? creds.apiSecret : "") || "",
  };
}

/** The live LiveKit config  only when configured AND switched on. */
export async function getLivekitConfig(): Promise<LivekitConfig | null> {
  const it = await getPlatformIntegration("livekit");
  if (!it || !it.enabled) return null;
  const { provider, wsUrl, apiKey, apiSecret } = activeLivekitCreds(it.creds);
  if (!wsUrl || !apiKey || !apiSecret) return null;
  return { provider, mode: provider === "cloud" ? "live" : "demo", wsUrl, apiKey, apiSecret };
}

export async function livekitConfigured(): Promise<boolean> {
  return Boolean(await getLivekitConfig());
}

/** One LiveKit room per appointment. */
export function roomNameForAppointment(appointmentId: string): string {
  return `phila_${appointmentId}`;
}

// Join-link signing is independent of the LiveKit secret (so rotating LiveKit creds
// never invalidates a client's booking link).
const joinSecret = () => process.env.BETTER_AUTH_SECRET ?? "phila-dev";

/** Sign an appointment id so a public join link can't be forged or enumerated. */
export function signJoin(appointmentId: string): string {
  return createHmac("sha256", joinSecret()).update(`join:${appointmentId}`).digest("base64url").slice(0, 24);
}
export function verifyJoin(appointmentId: string, sig: string | null | undefined): boolean {
  if (!sig) return false;
  const want = signJoin(appointmentId);
  // Constant-time compare so the join token can't be brute-forced by timing.
  if (sig.length !== want.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(want));
  } catch {
    return false;
  }
}

/** The Phila room page for an appointment (the "link"  carries a signed token). */
export function videoJoinPath(appointmentId: string): string {
  return `/room/${appointmentId}?t=${signJoin(appointmentId)}`;
}

/**
 * Mint a join token for a participant. Counsellors and clients both publish (it's a
 * two-way session); the grant is scoped to this room only.
 */
export async function mintToken(cfg: Pick<LivekitConfig, "apiKey" | "apiSecret">, opts: { roomName: string; identity: string; name: string; canPublish?: boolean }): Promise<string> {
  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, { identity: opts.identity, name: opts.name, ttl: "3h" });
  at.addGrant({ roomJoin: true, room: opts.roomName, canPublish: opts.canPublish ?? true, canSubscribe: true });
  return at.toJwt();
}

/** Test a candidate config against the LiveKit server (lists rooms → validates auth + reachability). */
export async function testLivekit(wsUrl: string, apiKey: string, apiSecret: string): Promise<{ ok: boolean; detail: string }> {
  if (!wsUrl || !apiKey || !apiSecret) return { ok: false, detail: "Fill in the URL, key, and secret first." };
  const httpUrl = wsUrl.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");
  try {
    const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await client.listRooms();
    return { ok: true, detail: `Connected to LiveKit at ${wsUrl}.` };
  } catch {
    return { ok: false, detail: "Couldn't reach LiveKit  check the server is running and the key/secret are correct." };
  }
}
