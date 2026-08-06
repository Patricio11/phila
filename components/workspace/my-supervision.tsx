import Link from "next/link";
import { CheckCircle2, Clock, MessageSquareText, NotebookPen, UserCog } from "lucide-react";
import type { MySupervisionView } from "@/db/queries/supervision";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Batch 2 - "Your supervision": the supervised counsellor's own view. Who
 * supervises you, where your notes stand, and exactly what feedback came back.
 */
export function MySupervision({ view }: { view: MySupervisionView }) {
  const { supervisor, awaiting, changesRequested, recentApproved } = view;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3.5">
        <StatCard icon={Clock} value={String(awaiting.length)} label="Awaiting review" />
        <StatCard icon={MessageSquareText} value={String(changesRequested.length)} label="Changes requested" tone={changesRequested.length > 0 ? "warn" : "default"} />
        <StatCard icon={CheckCircle2} value={String(recentApproved.length)} label="Recently signed off" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Your supervisor */}
        <Card className="h-fit p-5">
          <div className="flex items-center gap-2 text-[13px] font-[600] text-text">
            <UserCog className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Your supervisor
          </div>
          {supervisor ? (
            <>
              <div className="mt-3.5 flex items-center gap-3">
                <Avatar name={supervisor.name} size="lg" verified={supervisor.credential.status === "verified"} />
                <div className="min-w-0">
                  <div className="text-[14.5px] font-[640] text-text">{supervisor.name}</div>
                  <div className="mt-1"><CredentialChip body={supervisor.credential.body} status={supervisor.credential.status} /></div>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-text-3">
                They review your signed notes, and their sign-off appears on each one. Reach them any time on Messages.
              </p>
              <Link href="/app/messages" className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                <MessageSquareText className="size-3.5" strokeWidth={2} aria-hidden /> Message {supervisor.name.split(" ")[0]}
              </Link>
            </>
          ) : (
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-2">
              No supervisor is assigned to you yet - the practice sets this under Team.
            </p>
          )}
        </Card>

        {/* Feedback + status */}
        <div className="space-y-6">
          {changesRequested.length > 0 && (
            <Card>
              <CardHead title="Feedback from your supervisor" count={changesRequested.length} />
              <div className="space-y-3 px-[17px] pb-[17px]">
                {changesRequested.map((n) => (
                  <div key={n.noteId} className="rounded-control border border-warn/40 bg-warn-soft/30 p-3.5">
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <span className="font-medium text-text">{n.clientName}</span>
                      <span className="text-text-3">{n.serviceName} · {when(n.sessionAt)}</span>
                      <span className="ml-auto rounded-chip bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">Changes requested</span>
                    </div>
                    {n.supervisorComment && (
                      <p className="mt-2 text-[13px] leading-relaxed text-text-2">&ldquo;{n.supervisorComment}&rdquo;</p>
                    )}
                    <Link href={`/app/sessions/${n.appointmentId}`} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                      <NotebookPen className="size-3.5" strokeWidth={2} aria-hidden /> Open the note and revise
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHead title="Awaiting review" count={awaiting.length} />
            <div className="px-[17px] pb-[17px]">
              {awaiting.length === 0 ? (
                <p className="text-[12.5px] text-text-3">Nothing waiting - every signed note has been reviewed.</p>
              ) : (
                <ul className="space-y-1.5">
                  {awaiting.map((n) => (
                    <li key={n.noteId} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-28 shrink-0 tabular-nums text-text-3">{when(n.sessionAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-text-2">{n.clientName} · {n.serviceName}</span>
                      <span className="shrink-0 text-[11.5px] text-text-3">signed {when(n.signedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Signed off" count={recentApproved.length} />
            <div className="px-[17px] pb-[17px]">
              {recentApproved.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No sign-offs yet" body="Approved notes appear here with your supervisor's stamp." />
              ) : (
                <ul className="space-y-1.5">
                  {recentApproved.map((n) => (
                    <li key={n.noteId} className="flex items-center gap-2 text-[12.5px]">
                      <CheckCircle2 className="size-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                      <span className="w-24 shrink-0 tabular-nums text-text-3">{when(n.sessionAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-text-2">{n.clientName} · {n.serviceName}</span>
                      {n.supervisorComment && <span className={cn("hidden shrink-0 italic text-text-3 sm:inline")}>&ldquo;{n.supervisorComment.slice(0, 40)}{n.supervisorComment.length > 40 ? "…" : ""}&rdquo;</span>}
                      <span className="shrink-0 text-[11.5px] text-text-3">{n.supervisorSignedAt ? when(n.supervisorSignedAt) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
