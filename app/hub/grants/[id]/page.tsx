import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { coverageNote } from "@/lib/domain/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { GrantDashboard } from "@/components/funder/grant-dashboard";
import { NarrativeComposer } from "@/components/funder/narrative-composer";
import { ReportExport } from "@/components/funder/funder-actions";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";

function rands(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
function period(start: string, end: string): string {
  const f = (d: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T12:00:00Z`));
  return `${f(start)} – ${f(end)}`;
}

export default async function GrantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const view = await provider.getGrantView(id, now);
  if (!view || view.grant.orgId !== membership.orgId) notFound();

  await logAccess({
    action: "demographics.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `grant:${id}/dashboard`,
    reason: "grant_oversight",
  });

  const { grant, funder } = view;

  return (
    <div className="rise space-y-6">
      <Link href="/hub/funders" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All grants
      </Link>

      <PageHead
        title={grant.title}
        summary={`${funder.name} · ${period(grant.periodStart, grant.periodEnd)} · ${rands(grant.amountCents)}`}
        actions={<ReportExport grantId={grant.id} />}
      />

      {/* Period + allocation strip */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-[160px] flex-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-3">Period elapsed</span>
              <span className="font-semibold tabular-nums text-text">{view.periodElapsedPct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${view.periodElapsedPct}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <Users className="size-4 text-text-3" strokeWidth={2} aria-hidden />
            <span className="font-semibold text-text">{view.allocatedCount}</span>
            <span className="text-text-2">tagged · {coverageNote(view.withDemographics, view.allocatedCount, "consented demographics")}</span>
          </div>
          <Tag tone={grant.status === "active" ? "accent" : "neutral"}>{grant.status}</Tag>
        </div>
      </Card>

      <GrantDashboard
        indicators={view.indicators}
        breakdowns={view.breakdowns}
        outcome={view.outcome}
        narratives={view.narratives}
        narrativeSlot={<NarrativeComposer grantId={grant.id} initial={view.narratives} />}
      />
    </div>
  );
}
