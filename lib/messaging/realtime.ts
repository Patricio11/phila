import "server-only";
import { createHmac } from "node:crypto";
import { getPlatformIntegration } from "@/db/queries/platform-integrations";

/**
 * Supabase Realtime for the team chat (live delivery + presence). Neon stays the
 * source of truth; this layer just pushes a "new message" event so subscribed
 * clients append it instantly. Reuses the Phila Storage · Supabase config
 * (url + service-role + anon key). Dormant-by-Default: if it's not configured,
 * broadcasting is a no-op and the chat falls back to load-on-refresh.
 *
 * Channels are keyed by the **thread id** (a random, unguessable `mt_<uuid>`), so
 * only members  who legitimately hold the id  can subscribe. (Private channels
 * with Supabase RLS auth are the later hardening step.)
 */
interface RealtimeCreds { url: string; serviceKey: string; anonKey: string }

async function getCreds(): Promise<RealtimeCreds | null> {
  const it = await getPlatformIntegration("phila_storage");
  const url = it?.creds.url?.trim();
  const serviceKey = it?.creds.serviceKey?.trim();
  const anonKey = it?.creds.anonKey?.trim();
  if (!url || !serviceKey || !anonKey) return null;
  return { url, serviceKey, anonKey };
}

export interface RealtimeMessagePayload {
  threadId: string;
  id: string;
  senderId: string;
  text: string;
  at: string;
  senderName?: string;
  attachment?: { name: string; contentType: string; bytes: number };
}

/** Push a new message to a thread's channel. Best-effort; never throws. */
export async function broadcastToThread(threadId: string, payload: RealtimeMessagePayload): Promise<void> {
  try {
    const creds = await getCreds();
    if (!creds) return;
    await fetch(`${creds.url.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: creds.serviceKey, Authorization: `Bearer ${creds.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: `thread:${threadId}`, event: "message", payload }] }),
    });
  } catch {
    /* live delivery is best-effort; the message is persisted in Neon regardless */
  }
}

/** Tell members (via their per-user channel) they've been added to a new group. */
export async function broadcastThreadAdded(memberUserIds: string[], thread: { id: string; title: string; memberCount: number }): Promise<void> {
  try {
    const creds = await getCreds();
    if (!creds || memberUserIds.length === 0) return;
    const messages = memberUserIds.map((uid) => ({ topic: `user:${uid}`, event: "thread_added", payload: thread }));
    await fetch(`${creds.url.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: creds.serviceKey, Authorization: `Bearer ${creds.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch {
    /* best-effort */
  }
}

/** Push an edit/delete to a thread's channel so open clients update in place. */
export async function broadcastMessageUpdate(threadId: string, payload: { messageId: string; text: string; edited: boolean; deleted: boolean }): Promise<void> {
  try {
    const creds = await getCreds();
    if (!creds) return;
    await fetch(`${creds.url.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: creds.serviceKey, Authorization: `Bearer ${creds.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: `thread:${threadId}`, event: "update", payload }] }),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Private-channel authorization (opt-in security hardening). When the super-admin
 * has pasted the Supabase **JWT secret** AND switched **private channels** on
 * (having run the RLS SQL — docs/SUPABASE_REALTIME_SETUP.md), we mint a short-lived
 * Supabase-compatible JWT scoping the user to exactly their channels via a `topics`
 * claim, and the client uses private channels. Off by default → public channels.
 */
export async function getRealtimeAuthSecret(): Promise<string | null> {
  const it = await getPlatformIntegration("phila_storage");
  if (it?.creds.realtimePrivate !== "true") return null;
  const jwtSecret = it.creds.jwtSecret?.trim();
  return jwtSecret ? jwtSecret : null;
}

/** Mint a Supabase-compatible HS256 JWT scoped to the user's channels (1h). */
export function signRealtimeToken(sub: string, topics: string[], secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub, role: "authenticated", iat: now, exp: now + 3600, topics })).toString("base64url");
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Public config the browser needs to subscribe (url + anon key + private mode). Null = dormant. */
export async function getRealtimePublicConfig(): Promise<{ url: string; anonKey: string; private: boolean } | null> {
  const creds = await getCreds();
  if (!creds) return null;
  const it = await getPlatformIntegration("phila_storage");
  const isPrivate = it?.creds.realtimePrivate === "true" && Boolean(it?.creds.jwtSecret);
  return { url: creds.url, anonKey: creds.anonKey, private: isPrivate };
}
