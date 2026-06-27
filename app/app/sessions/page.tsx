import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, NotebookPen, Video } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider, type AppointmentView } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";
import type { AppointmentState } from "@/lib/domain/enums";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sessions" };

const DOT: Record<AppointmentState, DotTone> = {
  scheduled: "grey",
  completed: "green",
  no_show: "amber",
  cancelled: "grey",
  rescheduled: "grey",
  postponed: "amber",
  discharged: "green",
  risk_flagged: "rose",
};

export default async function SessionsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = new Date().toISOString();
  const nowMs = new Date(now).getTime();
  const sessions = await provider.listCounsellorSessions(me.id, now);
  const upcoming = sessions
    .filter((s) => new Date(s.startsAt).getTime() > nowMs && s.state === "scheduled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sessions.filter((s) => !(new Date(s.startsAt).getTime() > nowMs && s.state === "scheduled"));

  return (
    <div className="rise space-y-6">
      <PageHead title="Sessions" summary="Open a session to take notes, draft with AI, and sign." />

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <SessionRow key={s.id} appt={s} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Recent</h2>
        {past.length > 0 ? (
          <div className="space-y-2">
            {past.map((s) => (
              <SessionRow key={s.id} appt={s} />
            ))}
          </div>
        ) : (
          <Card className="p-2">
            <EmptyState icon={NotebookPen} title="No sessions yet" body="Your sessions will appear here." />
          </Card>
        )}
      </section>
    </div>
  );
}

function SessionRow({ appt }: { appt: AppointmentView }) {
  const time = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(appt.startsAt));

  return (
    <Link
      href={`/app/sessions/${appt.id}`}
      className="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5 transition-colors hover:bg-surface-hover"
    >
      <Avatar name={appt.clientName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-medium text-text">{appt.clientName}</span>
          {appt.type === "online" ? (
            <Tag tone="online">
              <Video className="size-3" strokeWidth={2} aria-hidden /> Online
            </Tag>
          ) : appt.roomName ? (
            <Tag tone="neutral">{appt.roomName}</Tag>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-3">
          <StatusDot tone={DOT[appt.state]} /> {appt.serviceName} · {time}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
