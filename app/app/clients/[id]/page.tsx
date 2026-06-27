import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Lock, Mail, NotebookPen, Phone } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { isConsentActive } from "@/lib/consent";
import { CONSENT_PURPOSE_LABELS, type ConsentPurpose } from "@/lib/domain/enums";
import { AGE_BAND_LABELS, EMPLOYMENT_LABELS, GENDER_LABELS, POPULATION_GROUP_LABELS } from "@/lib/domain/labels";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionTimeline } from "@/components/client/session-timeline";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { SafeguardingPanel } from "@/components/workspace/safeguarding-panel";
import { StatusDot } from "@/components/ui/status-dot";

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const now = new Date().toISOString();
  const dossier = await provider.getClientDossier(id, now);
  if (!dossier || dossier.client.orgId !== membership.orgId) notFound();

  // Opening a client record is a recorded PII access (Protected & Audited Rule).
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `client:${id}/dossier`,
    reason: "clinical_care",
  });

  const { client, counsellor, consents, demographics, sessions, outcomes, documents } = dossier;
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
        {openSession && (
          <Button asChild>
            <Link href={`/app/sessions/${openSession.id}`}>
              <NotebookPen className="size-4" strokeWidth={2} aria-hidden /> Open session
            </Link>
          </Button>
        )}
      </div>

      {client.riskFlag && <SafeguardingPanel clientName={client.name} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHead title="Outcome trend" />
            <div className="px-[17px] pb-[17px]">
              {points.length >= 2 ? (
                <OutcomeSparkline points={points} tool={outcomes[0]?.tool ?? "PHQ-9"} coverage={`${outcomes.length} measures captured`} />
              ) : (
                <p className="py-6 text-center text-[12.5px] text-text-3">
                  Not yet measured — capture a PHQ-9 or GAD-7 in a session to start a trend.
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
                <div className="flex items-start gap-2.5 rounded-control bg-surface-2 p-3 text-[12.5px] text-text-2">
                  <Lock className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                  Not shared — this client hasn&apos;t consented to demographic information. It stays hidden until they do.
                </div>
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
