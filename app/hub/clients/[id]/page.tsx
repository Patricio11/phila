import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, FileText, Mail, Phone, ShieldCheck, Target } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { isConsentActive } from "@/lib/consent";
import { CONSENT_PURPOSE_LABELS, type ConsentPurpose } from "@/lib/domain/enums";
import { AGE_BAND_LABELS, EMPLOYMENT_LABELS, GENDER_LABELS, POPULATION_GROUP_LABELS } from "@/lib/domain/labels";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDot } from "@/components/ui/status-dot";
import { BlockedState } from "@/components/ui/blocked-state";
import { SessionTimeline } from "@/components/client/session-timeline";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { ReassignClientButton } from "@/components/hub/reassign-client-button";
import { InviteClientButton } from "@/components/hub/invite-client-button";
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

export default async function HubClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [dossier, counsellors] = await Promise.all([
    provider.getClientDossier(id, now),
    provider.listCounsellors(membership.orgId),
  ]);
  if (!dossier || dossier.client.orgId !== membership.orgId) notFound();

  // Hub oversight is a recorded PII access  but private clinical notes are never on this page.
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${id}/hub`,
    reason: "hub_oversight",
  });

  const { client, counsellor, org, consents, demographics, sessions, outcomes, documents, carePlan } = dossier;
  const attended = sessions.filter((s) => s.state === "completed" || s.state === "discharged").length;
  const noShow = sessions.filter((s) => s.state === "no_show").length;
  const attendanceRate = attended + noShow > 0 ? Math.round((attended / (attended + noShow)) * 100) : null;
  const points = [...outcomes]
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((o) => ({ label: new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(o.takenAt)), value: o.score }));
  const counsellorOpts = counsellors.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="rise space-y-6">
      <Link href="/hub/clients" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All clients
      </Link>

      <PageHead
        title={
          <span className="flex items-center gap-2.5">
            <Avatar name={client.name} size="md" /> {client.name}
          </span>
        }
        summary={`With ${counsellor.name} · ${client.province}`}
        actions={
          <div className="flex items-center gap-2">
            <InviteClientButton clientId={client.id} clientName={client.name} phone={client.phone ?? null} email={client.email ?? null} whatsappOn={Boolean(org.features.whatsapp)} smsOn={Boolean(org.features.sms)} />
            <ReassignClientButton clientId={client.id} clientName={client.name} counsellors={counsellorOpts} currentCounsellorId={counsellor.id} />
            <Button asChild>
              <Link href="/hub/appointments"><CalendarPlus className="size-4" strokeWidth={2} aria-hidden /> Book session</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-2">
        {client.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {client.phone}</span>}
        {client.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {client.email}</span>}
        {client.riskFlag && <span className="inline-flex items-center gap-1.5 text-danger"><StatusDot tone="rose" /> Safeguarding flag</span>}
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat value={String(attended)} label={`Session${attended === 1 ? "" : "s"} attended`} />
        <Stat value={attendanceRate === null ? "" : `${attendanceRate}%`} label={noShow > 0 ? `Attendance · ${noShow} no-show${noShow === 1 ? "" : "s"}` : "Attendance"} />
        <Stat value={timeInCare(client.createdAt, now)} label="In care" />
        <Stat value={points[points.length - 1] ? String(points[points.length - 1]!.value) : ""} label={outcomes[0]?.tool ?? "Outcome"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHead title="Outcome trend" />
            <div className="px-[17px] pb-[17px]">
              {points.length >= 2 ? (
                <OutcomeSparkline points={points} tool={outcomes[0]?.tool ?? "PHQ-9"} coverage={`${outcomes.length} measures captured`} />
              ) : (
                <p className="py-6 text-center text-[12.5px] text-text-3">Not yet measured.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Session history" count={sessions.length} />
            <div className="px-[17px] pb-[17px]">
              {sessions.length > 0 ? (
                <SessionTimeline
                  appointments={sessions}
                  nowISO={now}
                  hrefFor={(a) => (a.state === "scheduled" ? null : `/hub/sessions/${a.id}`)}
                />
              ) : (
                <EmptyState icon={CalendarPlus} title="No sessions yet" body="Sessions appear here once booked." />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-accent/20 bg-accent-soft/30 p-4">
            <div className="flex items-center gap-2 text-[13px] font-[600] text-text">
              <ShieldCheck className="size-4 text-accent" strokeWidth={2} aria-hidden /> Full clinic access
            </div>
            <p className="mt-1 text-[12px] text-text-2">Open any past session to read {counsellor.name.split(" ")[0]}&apos;s clinical note. Every note you open is recorded in the audit trail.</p>
          </Card>

          {carePlan && (
            <Card>
              <CardHead title={<span className="flex items-center gap-2"><Target className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Care plan</span>} />
              <div className="px-[17px] pb-[17px]">
                <p className="text-[12.5px] leading-relaxed text-text-2">{carePlan.summary}</p>
                <div className="mt-2 text-[11.5px] text-text-3">{carePlan.tasks.filter((t) => t.done).length}/{carePlan.tasks.length} goals on track</div>
              </div>
            </Card>
          )}

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
                      <span className="inline-flex items-center gap-2 text-text-2"><StatusDot tone={on ? "green" : "grey"} /> {CONSENT_PURPOSE_LABELS[c.purpose as ConsentPurpose]}</span>
                      <span className={on ? "text-[11.5px] font-semibold text-accent" : "text-[11.5px] text-text-3"}>{on ? "On" : "Off"}</span>
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
                <BlockedState reason="consent" title="Demographics not shared" body="Hidden until the client consents." />
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="text-[22px] font-bold tabular-nums text-text">{value}</div>
      <div className="truncate text-[12px] text-text-2">{label}</div>
    </div>
  );
}
