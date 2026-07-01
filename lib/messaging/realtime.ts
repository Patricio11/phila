import "server-only";
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

/** Public config the browser needs to subscribe (url + anon key). Null = dormant. */
export async function getRealtimePublicConfig(): Promise<{ url: string; anonKey: string } | null> {
  const creds = await getCreds();
  return creds ? { url: creds.url, anonKey: creds.anonKey } : null;
}
