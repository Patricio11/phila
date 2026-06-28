import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, FileText, Mail, MessageSquare, NotebookPen, Phone, Target, TrendingDown, TrendingUp } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { isConsentActive } from "@/lib/consent";
import { CONSENT_PURPOSE_LABELS, type ConsentPurpose } from "@/lib/domain/enums";
import { AGE_BAND_LABELS, EMPLOYMENT_LABELS, GENDER_LABELS, POPULATION_GROUP_LABELS } from "@/lib/domain/labels";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionTimeline } from "@/components/client/session-timeline";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { SafeguardingPanel } from "@/components/workspace/safeguarding-panel";
import { CounsellorCareSteps } from "@/components/client/counsellor-care-steps";
import { StatusDot } from "@/components/ui/status-dot";
import { BlockedState } from "@/components/ui/blocked-state";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";

function timeInCare(createdAt: string, now: string): string {
  const months = Math.round((new Date(now).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4));
  if (months < 1) return "< 1 month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} year${y === 1 ? "" : "s"}` : `${y}y ${m}m`;
}

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const now = clockNow();
  const [dossier, counsellors] = await Promise.all([
    provider.getClientDossier(id, now),
    provider.listCounsellors(membership.orgId),
  ]);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!dossier || !me || dossier.client.orgId !== membership.orgId) notFound();

  // A counsellor reaches only their own clients (and, if a supervisor, their
  // supervisees') — never another counsellor's caseload. The Hub has full access.
  const author = counsellors.find((c) => c.id === dossier.client.primaryCounsellorId);
  const isMine = dossier.client.primaryCounsellorId === me.id;
  const isSupervisee = me.isSupervisor && author?.supervisorId === me.id;
  if (!isMine && !isSupervisee) notFound();

  // Opening a client record is a recorded PII access (Protected & Audited Rule).
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `client:${id}/dossier`,
    reason: "clinical_care",
  });

  const { client, counsellor, consents, demographics, sessions, outcomes, documents, carePlan } = dossier;
  const nowMs = new Date(now).getTime();
  const nextScheduled = sessions
    .filter((s) => new Date(s.startsAt).getTime() > nowMs && s.state === "scheduled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const latestPast = sessions.find((s) => new Date(s.startsAt).getTime() <= nowMs);
  const openSession = nextScheduled ?? latestPast;

  const points = [...outcomes]
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((o) => ({
      label: new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(o.takenAt)),
      value: o.score,
    }));

  // At-a-glance clinical metrics  attendance never counts soft-deleted records.
  const attended = sessions.filter((s) => s.state === "completed" || s.state === "discharged").length;
  const noShow = sessions.filter((s) => s.state === "no_show").length;
  const attendanceRate = attended + noShow > 0 ? Math.round((attended / (attended + noShow)) * 100) : null;
  const firstScore = points[0]?.value ?? null;
  const lastScore = points[points.length - 1]?.value ?? null;
  const delta = firstScore !== null && lastScore !== null ? lastScore - firstScore : null;
  const goalsDone = carePlan ? carePlan.tasks.filter((t) => t.done).length : 0;

  return (
    <div className="rise space-y-6">
      <Link href="/app/clients" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All clients
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar name={client.name} size="lg" />
          <div>
            <h2 className="text-[21px] font-[680] tracking-[-0.025em] text-text">{client.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-2">
              <span>{client.province}</span>
              {client.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {client.phone}
                </span>
              )}
              {client.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {client.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/app/messages">
              <MessageSquare className="size-4" strokeWidth={2} aria-hidden /> Message
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app/calendar">
              <CalendarPlus className="size-4" strokeWidth={2} aria-hidden /> Book
            </Link>
          </Button>
          {openSession && (
            <Button asChild>
              <Link href={`/app/sessions/${openSession.id}`}>
                <NotebookPen className="size-4" strokeWidth={2} aria-hidden /> Open session
              </Link>
            </Button>
          )}
        </div>
      </div>

      {client.riskFlag && <SafeguardingPanel clientName={client.name} />}

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat value={String(attended)} label={`Session${attended === 1 ? "" : "s"} attended`} />
        <Stat value={attendanceRate === null ? "" : `${attendanceRate}%`} label={noShow > 0 ? `Attendance · ${noShow} no-show${noShow === 1 ? "" : "s"}` : "Attendance"} />
        <Stat value={timeInCare(client.createdAt, now)} label="In care" />
        <Stat
          value={lastScore === null ? "" : String(lastScore)}
          label={outcomes[0]?.tool ?? "Outcome"}
          trend={
            delta === null || delta === 0 ? null : delta < 0
              ? { icon: TrendingDown, text: `${Math.abs(delta)} pts · improving`, tone: "accent" as const }
              : { icon: TrendingUp, text: `${delta} pts · watch`, tone: "warn" as const }
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left */}
        <div className="space-y-6 lg:col-span-2">
          {/* Care plan */}
          <Card>
            <CardHead
              title="Care plan"
              action={carePlan ? <Tag tone="accent">{goalsDone}/{carePlan.tasks.length} goals on track</Tag> : undefined}
            />
            <div className="px-[17px] pb-[17px]">
              {carePlan ? (
                <div className="space-y-4">
                  <p className="text-[13.5px] leading-relaxed text-text-2">{carePlan.summary}</p>
                  <CounsellorCareSteps clientId={client.id} clientFirstName={client.name.split(" ")[0] ?? "the client"} tasks={carePlan.tasks} />
                  {carePlan.nextStep && (
                    <div className="rounded-control border border-accent/20 bg-accent-soft/40 p-3 text-[12.5px] text-text-2">
                      <span className="font-semibold text-text">Next step · </span>{carePlan.nextStep}
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState icon={Target} title="No care plan yet" body="Set a few shared goals and a next step  the client can see this in their portal once shared." />
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Outcome trend" />
            <div className="px-[17px] pb-[17px]">
              {points.length >= 2 ? (
                <OutcomeSparkline points={points} tool={outcomes[0]?.tool ?? "PHQ-9"} coverage={`${outcomes.length} measures captured`} />
              ) : (
                <p className="py-6 text-center text-[12.5px] text-text-3">
                  Not yet measured  capture a PHQ-9 or GAD-7 in a session to start a trend.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Session history" count={sessions.length} />
            <div className="px-[17px] pb-[17px]">
              {sessions.length > 0 ? (
                <SessionTimeline appointments={sessions} nowISO={now} />
              ) : (
                <EmptyState icon={NotebookPen} title="No sessions yet" body="Sessions will appear here once booked." />
              )}
            </div>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card>
            <CardHead title="Consent" />
            <div className="space-y-2 px-[17px] pb-[17px]">
              {consents.length === 0 ? (
                <p className="text-[12.5px] text-text-3">No consents recorded.</p>
              ) : (
                consents.map((c) => {
                  const on = isConsentActive(c);
                  return (
                    <div key={c.purpose} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="inline-flex items-center gap-2 text-text-2">
                        <StatusDot tone={on ? "green" : "grey"} />
                        {CONSENT_PURPOSE_LABELS[c.purpose as ConsentPurpose]}
                      </span>
                      <span className={on ? "text-[11.5px] font-semibold text-accent" : "text-[11.5px] text-text-3"}>
                        {on ? "On" : "Off"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Demographics" />
            <div className="px-[17px] pb-[17px]">
              {demographics ? (
                <dl className="space-y-2 text-[13px]">
                  <Field label="Gender" value={GENDER_LABELS[demographics.gender]} />
                  <Field label="Population group" value={POPULATION_GROUP_LABELS[demographics.populationGroup]} />
                  <Field label="Employment" value={EMPLOYMENT_LABELS[demographics.employmentStatus]} />
                  <Field label="Age band" value={AGE_BAND_LABELS[demographics.ageBand]} />
                </dl>
              ) : (
                <BlockedState
                  reason="consent"
                  title="Demographics not shared"
                  body="This client hasn't consented to demographic information. It stays hidden until they do."
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Documents" count={documents.length} />
            <div className="space-y-2 px-[17px] pb-[17px]">
              {documents.length === 0 ? (
                <p className="text-[12.5px] text-text-3">No documents.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2.5 text-[13px]">
                    <FileText className="size-4 shrink-0 text-text-3" strokeWidth={1.9} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-text-2">{doc.name}</span>
                    <span className="shrink-0 text-[11px] text-text-3">{doc.sizeLabel}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <p className="px-1 text-[11px] text-text-3">
            With {counsellor.name.split(" ")[0]} · client since{" "}
            {new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "long", year: "numeric" }).format(new Date(client.createdAt))}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-3">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}

function Stat({ value, label, trend }: { value: string; label: string; trend?: { icon: typeof TrendingDown; text: string; tone: "accent" | "warn" } | null }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="text-[22px] font-bold tabular-nums text-text">{value}</div>
      <div className="truncate text-[12px] text-text-2">{label}</div>
      {trend && (
        <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${trend.tone === "accent" ? "text-accent" : "text-warn"}`}>
          <trend.icon className="size-3.5" strokeWidth={2.2} aria-hidden /> {trend.text}
        </div>
      )}
    </div>
  );
}
