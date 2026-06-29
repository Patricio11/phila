import "server-only";
import { createHmac } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";

/**
 * LiveKit server helpers (Phase 13). Tokens are minted server-side so the API
 * secret never reaches the browser; the client only ever receives a short-lived
 * JWT scoped to ONE room. Self-host (docker-compose.livekit.yml) or LiveKit Cloud —
 * the app only reads LIVEKIT_* env, so switching is a config change. See
 * docs/LIVEKIT_SETUP.md.
 */
export function livekitConfigured(): boolean {
  return Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.NEXT_PUBLIC_LIVEKIT_URL);
}

/** One LiveKit room per appointment. */
export function roomNameForAppointment(appointmentId: string): string {
  return `phila_${appointmentId}`;
}

const joinSecret = () => process.env.LIVEKIT_API_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "phila-dev";

/** Sign an appointment id so a public join link can't be forged or enumerated. */
export function signJoin(appointmentId: string): string {
  return createHmac("sha256", joinSecret()).update(`join:${appointmentId}`).digest("base64url").slice(0, 24);
}
export function verifyJoin(appointmentId: string, sig: string | null | undefined): boolean {
  return Boolean(sig) && sig === signJoin(appointmentId);
}

/** The Phila room page for an appointment (the "link" — carries a signed token). */
export function videoJoinPath(appointmentId: string): string {
  return `/room/${appointmentId}?t=${signJoin(appointmentId)}`;
}

/**
 * Mint a join token for a participant. Counsellors and clients both publish (it's
 * a two-way session); the grant is scoped to this room only.
 */
export async function mintToken(opts: { roomName: string; identity: string; name: string; canPublish?: boolean }): Promise<string> {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: opts.identity,
    name: opts.name,
    ttl: "3h",
  });
  at.addGrant({ roomJoin: true, room: opts.roomName, canPublish: opts.canPublish ?? true, canSubscribe: true });
  return at.toJwt();
}
