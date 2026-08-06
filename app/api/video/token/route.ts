import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments } from "@/db/schema";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { getLivekitConfig, mintToken, roomNameForAppointment, verifyJoin } from "@/lib/video/livekit";

export const dynamic = "force-dynamic";

/**
 * Mint a LiveKit join token for an appointment's room (Phase 13). Access is granted
 * to an authenticated counsellor/admin of the appointment's org, OR to anyone with
 * the signed join link (HMAC `t`)  so clients without an account can join from
 * their booking link. The API secret stays server-side; the browser only gets a
 * short-lived JWT scoped to this one room.
 */
export async function POST(req: Request) {
  const cfg = await getLivekitConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Video isn't configured yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { appointmentId?: string; classSessionId?: string; name?: string; t?: string };

  // Class sessions (batch 2b): staff-only rooms - authorised by org membership
  // (supervisor / member / org admin), never by link.
  const classSessionId = body.classSessionId?.trim();
  if (classSessionId) {
    const principal = await getCurrentPrincipal();
    if (!principal) return NextResponse.json({ error: "Sign in to join this class." }, { status: 401 });
    const { classSessionDb } = await import("@/db/queries/classrooms");
    const found = await classSessionDb(null, classSessionId);
    if (!found) return NextResponse.json({ error: "Class session not found." }, { status: 404 });
    const m = principal.memberships.find((x) => x.orgId === found.cls.orgId);
    if (!m) return NextResponse.json({ error: "This class isn't in your practice." }, { status: 403 });
    const { counsellorIdForUser } = await import("@/db/queries/session-notes");
    const meId = await counsellorIdForUser(found.cls.orgId, principal.userId);
    const allowed = m.teamRole === "org_admin" || (meId && (found.cls.supervisorId === meId || found.memberIds.includes(meId)));
    if (!allowed) return NextResponse.json({ error: "You're not in this classroom." }, { status: 403 });
    const isHost = meId === found.cls.supervisorId;
    const token = await mintToken(cfg, { roomName: `phila_class_${classSessionId}`, identity: `staff_${principal.userId}`, name: principal.name, canPublish: true });
    return NextResponse.json({ token, url: cfg.wsUrl, identity: `staff_${principal.userId}`, name: principal.name, role: isHost ? "host" : "guest" });
  }

  const appointmentId = body.appointmentId?.trim();
  if (!appointmentId) return NextResponse.json({ error: "Missing appointment." }, { status: 400 });

  const [appt] = await getDb().select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!appt) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  if (appt.type !== "online" && appt.type !== "hybrid") return NextResponse.json({ error: "This session isn't online." }, { status: 400 });

  const principal = await getCurrentPrincipal();
  // Host = a clinical/admin member of the appointment's org; other roles + guests must
  // present the time-bound signed link.
  const isHost = Boolean(principal && principal.memberships.some((m) => m.orgId === appt.orgId && (m.teamRole === "org_admin" || m.teamRole === "counsellor")));
  const hasGrant = verifyJoin(appointmentId, appt.startsAt.toISOString(), body.t);
  if (!isHost && !hasGrant) {
    return NextResponse.json({ error: "This join link isn't valid." }, { status: 403 });
  }

  const identity = isHost && principal ? `host_${principal.userId}` : `guest_${crypto.randomUUID().slice(0, 8)}`;
  const name = (isHost && principal ? principal.name : body.name?.trim()) || "Guest";
  const token = await mintToken(cfg, { roomName: roomNameForAppointment(appointmentId), identity, name, canPublish: true });

  return NextResponse.json({ token, url: cfg.wsUrl, identity, name, role: isHost ? "host" : "guest" });
}
