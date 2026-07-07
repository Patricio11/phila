import { eq } from "drizzle-orm";
import { VideoOff, Video, ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { appointments, clients, counsellors, services, orgs } from "@/db/schema";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { livekitConfigured, verifyJoin } from "@/lib/video/livekit";
import { getVideoSettings } from "@/db/queries/video";
import { VideoSession } from "@/components/video/video-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video session" };

function startsLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function RoomPage({ params, searchParams }: { params: Promise<{ appointmentId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { appointmentId } = await params;
  const { t } = await searchParams;

  const [row] = await getDb()
    .select({ a: appointments, orgName: orgs.name, counsellorName: counsellors.name, serviceName: services.name, clientName: clients.name })
    .from(appointments)
    .leftJoin(orgs, eq(appointments.orgId, orgs.id))
    .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const principal = await getCurrentPrincipal();
  // Host = a clinical/admin member of the appointment's org (not front-desk/finance/
  // programme roles, who have no business in a therapy room). Guests join via the link.
  const isHost = Boolean(row && principal && principal.memberships.some((m) => m.orgId === row.a.orgId && (m.teamRole === "org_admin" || m.teamRole === "counsellor")));
  const allowed = Boolean(row && row.a.type === "online" && (isHost || verifyJoin(appointmentId, row.a.startsAt.toISOString(), t)));

  if (!allowed || !row) {
    return <Unavailable configured={await livekitConfigured()} reason={!row ? "not_found" : row.a.type !== "online" ? "not_online" : "bad_link"} />;
  }

  // Paste-link fallback: the org runs video on its own meeting link.
  const video = await getVideoSettings(row.a.orgId);
  if (video.mode === "external") {
    return <ExternalRoom orgName={row.orgName ?? "Your practice"} url={video.externalUrl} />;
  }

  return (
    <VideoSession
      appointmentId={appointmentId}
      sig={t ?? ""}
      orgName={row.orgName ?? "Your practice"}
      hostName={(row.counsellorName ?? "Your counsellor").split(" ")[0] ?? "Your counsellor"}
      serviceName={row.serviceName ?? "Online session"}
      startsAtLabel={startsLabel(row.a.startsAt)}
      defaultName={isHost ? (principal?.name ?? "") : (row.clientName ?? "")}
      isHost={isHost}
    />
  );
}

function ExternalRoom({ orgName, url }: { orgName: string; url: string | null }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"><Video className="size-6" strokeWidth={2} aria-hidden /></div>
        <h1 className="text-[18px] font-[680] text-text">{orgName} meets on their own link</h1>
        {url ? (
          <>
            <p className="text-[14px] text-text-2">Your session happens on {orgName}&apos;s meeting link. Open it when it&apos;s time.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-[14px] font-medium text-white hover:brightness-95">
              <ExternalLink className="size-4" strokeWidth={2} aria-hidden /> Open meeting link
            </a>
          </>
        ) : (
          <p className="text-[14px] text-text-2">{orgName} hasn&apos;t added their meeting link yet. They&apos;ll send it to you before your session.</p>
        )}
      </div>
    </div>
  );
}

function Unavailable({ reason, configured }: { reason: "not_found" | "not_online" | "bad_link"; configured: boolean }) {
  const msg = !configured
    ? "Video isn't switched on yet. The practice will share another way to meet."
    : reason === "not_found"
      ? "This session link isn't valid."
      : reason === "not_online"
        ? "This appointment isn't an online session."
        : "This link has expired or is incorrect. Please use the latest link from your booking.";
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="max-w-sm space-y-3 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-3"><VideoOff className="size-6" strokeWidth={2} aria-hidden /></div>
        <h1 className="text-[18px] font-[680] text-text">Session unavailable</h1>
        <p className="text-[14px] text-text-2">{msg}</p>
      </div>
    </div>
  );
}
