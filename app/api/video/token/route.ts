import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments } from "@/db/schema";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { livekitConfigured, mintToken, roomNameForAppointment, verifyJoin } from "@/lib/video/livekit";

export const dynamic = "force-dynamic";

/**
 * Mint a LiveKit join token for an appointment's room (Phase 13). Access is granted
 * to an authenticated counsellor/admin of the appointment's org, OR to anyone with
 * the signed join link (HMAC `t`) — so clients without an account can join from
 * their booking link. The API secret stays server-side; the browser only gets a
 * short-lived JWT scoped to this one room.
 */
export async function POST(req: Request) {
  if (!livekitConfigured()) {
    return NextResponse.json({ error: "Video isn't configured yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { appointmentId?: string; name?: string; t?: string };
  const appointmentId = body.appointmentId?.trim();
  if (!appointmentId) return NextResponse.json({ error: "Missing appointment." }, { status: 400 });

  const [appt] = await getDb().select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (appt.type !== "online") return NextResponse.json({ error: "This session isn't online." }, { status: 400 });

  const principal = await getCurrentPrincipal();
  const isHost = Boolean(principal && principal.memberships.some((m) => m.orgId === appt.orgId));
  const hasGrant = verifyJoin(appointmentId, body.t);
  if (!isHost && !hasGrant) {
    return NextResponse.json({ error: "This join link isn't valid." }, { status: 403 });
  }

  const identity = isHost && principal ? `host_${principal.userId}` : `guest_${crypto.randomUUID().slice(0, 8)}`;
  const name = (isHost && principal ? principal.name : body.name?.trim()) || "Guest";
  const token = await mintToken({ roomName: roomNameForAppointment(appointmentId), identity, name, canPublish: true });

  return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL, identity, name, role: isHost ? "host" : "guest" });
}
