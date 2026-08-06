import { VideoOff } from "lucide-react";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { livekitConfigured, joinWindow, JOIN_OPEN_EARLY_MIN } from "@/lib/video/livekit";
import { classSessionDb } from "@/db/queries/classrooms";
import { counsellorIdForUser } from "@/db/queries/session-notes";
import { VideoSession } from "@/components/video/video-session";
import { WaitingRoom } from "@/components/video/waiting-room";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class session" };

function startsLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

/**
 * The classroom's live room (batch 2b) - staff only, authorised by org
 * membership (supervisor, class member, or org admin). Same doors-open logic
 * as client sessions: early arrivals wait, the room opens 15 minutes before.
 */
export default async function ClassRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const principal = await getCurrentPrincipal();
  const found = await classSessionDb(null, sessionId);

  const m = principal && found ? principal.memberships.find((x) => x.orgId === found.cls.orgId) : null;
  const meId = m && found ? await counsellorIdForUser(found.cls.orgId, principal!.userId) : null;
  const allowed = Boolean(found && m && (m.teamRole === "org_admin" || (meId && (found.cls.supervisorId === meId || found.memberIds.includes(meId)))));

  if (!found || !allowed || found.session.mode !== "online") {
    const msg = !found ? "This class session link isn't valid."
      : !allowed ? "Sign in with your practice account - this room is for the class."
      : "This class session is in person.";
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
        <div className="max-w-sm space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-3"><VideoOff className="size-6" strokeWidth={2} aria-hidden /></div>
          <h1 className="text-[18px] font-[680] text-text">Room unavailable</h1>
          <p className="text-[14px] text-text-2">{msg}</p>
        </div>
      </div>
    );
  }

  const startsISO = found.session.startsAt.toISOString();
  if (joinWindow(startsISO) === "early") {
    return (
      <WaitingRoom
        orgName={found.cls.name}
        serviceName={found.session.title}
        hostName="your supervisor"
        startsAtISO={startsISO}
        startsAtLabel={startsLabel(found.session.startsAt)}
        opensEarlyMin={JOIN_OPEN_EARLY_MIN}
      />
    );
  }

  const configured = await livekitConfigured();
  if (!configured) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
        <div className="max-w-sm space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-3"><VideoOff className="size-6" strokeWidth={2} aria-hidden /></div>
          <h1 className="text-[18px] font-[680] text-text">Video isn&apos;t switched on yet</h1>
          <p className="text-[14px] text-text-2">The practice hasn&apos;t configured video - your supervisor will share another way to meet.</p>
        </div>
      </div>
    );
  }

  return (
    <VideoSession
      appointmentId={sessionId}
      classSessionId={sessionId}
      sig=""
      orgName={found.cls.name}
      hostName="Supervisor"
      serviceName={found.session.title}
      startsAtLabel={startsLabel(found.session.startsAt)}
      defaultName={principal?.name ?? ""}
      isHost={meId === found.cls.supervisorId}
    />
  );
}
