import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, FileText, MapPin, ShieldCheck, Sparkles, Target, Video } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session note" };

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} · ${time}`;
}

export default async function HubSessionNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const data = await provider.getSession(id, now);
  if (!data || data.appointment.orgId !== membership.orgId) notFound();

  // The clinic owns the record  the Hub has full access, and every note read is
  // written to the audit trail (Protected & Audited Rule). Never silent.
  await logAccess({
    action: "note.read_hub_override",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `appointment:${id}/note`,
    reason: "hub_full_access",
  });

  const { appointment: appt, client, note, carePlan } = data;

  return (
    <div className="rise space-y-6">
      <Link href={`/hub/clients/${client.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to {client.name.split(" ")[0]}
      </Link>

      <PageHead
        title={
          <span className="flex items-center gap-2.5">
            <Avatar name={client.name} size="md" /> {client.name}
          </span>
        }
        summary={`${appt.serviceName} · with ${appt.counsellorName}`}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-2">
        <span className="inline-flex items-center gap-1"><Clock className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {whenLabel(appt.startsAt)}</span>
        <span className="inline-flex items-center gap-1">
          {appt.type === "online" ? <Video className="size-3.5 text-info" strokeWidth={2} aria-hidden /> : <MapPin className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />}
          {appt.type === "online" ? "Online" : (appt.roomName ?? "In person")}
        </span>
      </div>

      <div className="flex items-start gap-2.5 rounded-control border border-accent/25 bg-accent-soft/40 p-3.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-text-2">
          Full clinic access. You&apos;re viewing {appt.counsellorName.split(" ")[0]}&apos;s clinical note  this access is recorded in the audit trail.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHead
              title={<span className="flex items-center gap-2"><FileText className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Clinical note</span>}
              action={
                note?.signedAt ? (
                  <Tag tone="accent"><Check className="size-3" strokeWidth={2.5} aria-hidden /> Signed</Tag>
                ) : note ? (
                  <Tag tone="warn">Draft</Tag>
                ) : undefined
              }
            />
            <div className="px-[17px] pb-[17px]">
              {note?.body ? (
                <>
                  {note.aiGenerated && (
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-chip bg-surface-2 px-2 py-1 text-[11.5px] font-medium text-text-2">
                      <Sparkles className="size-3.5 text-accent" strokeWidth={2} aria-hidden /> AI-assisted, edited and signed by the counsellor
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text">{note.body}</p>
                  {note.signedAt && (
                    <p className="mt-4 border-t border-border pt-3 text-[12px] text-text-3">
                      Signed by {appt.counsellorName} · {new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(note.signedAt))}
                    </p>
                  )}
                </>
              ) : (
                <EmptyState icon={FileText} title="No note yet" body="This session doesn't have a clinical note recorded." />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {carePlan && (
            <Card>
              <CardHead title={<span className="flex items-center gap-2"><Target className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Care plan</span>} />
              <div className="px-[17px] pb-[17px]">
                <p className="text-[12.5px] leading-relaxed text-text-2">{carePlan.summary}</p>
                <div className="mt-2 text-[11.5px] text-text-3">{carePlan.tasks.filter((t) => t.done).length}/{carePlan.tasks.length} goals on track</div>
              </div>
            </Card>
          )}
          <Card className="p-4">
            <div className="text-[13px] font-[600] text-text">Status</div>
            <p className="mt-1 text-[12.5px] capitalize text-text-2">{appt.state.replace(/_/g, " ")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
