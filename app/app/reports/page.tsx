import { notFound } from "next/navigation";
import { CalendarDays, HeartPulse, UserX, Users } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider, type CaseloadStatus } from "@/lib/data-provider";
import { coverageNote } from "@/lib/mock/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

const STATUS: Record<CaseloadStatus, { label: string; tone: DotTone }> = {
  new: { label: "New", tone: "blue" },
  active: { label: "Active", tone: "green" },
  at_risk: { label: "Safeguarding", tone: "rose" },
  inactive: { label: "Inactive", tone: "grey" },
};

export default async function CounsellorReportsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = new Date().toISOString();
  const [dash, caseload] = await Promise.all([
    provider.getCounsellorDashboard(me.id, now),
    provider.listCaseload(me.id, now),
  ]);
  if (!dash) notFound();

  const byStatus = (["active", "new", "at_risk", "inactive"] as CaseloadStatus[]).map((s) => ({
    status: s,
    count: caseload.filter((r) => r.status === s).length,
  }));
  const maxStatus = Math.max(1, ...byStatus.map((b) => b.count));

  return (
    <div className="rise space-y-6">
      <PageHead title="Your reports" summary="A view of your caseload and outcomes  your own clients only." />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={Users} label="Clients in care" value={caseload.length} coverage="assigned to you" />
        <StatCard icon={CalendarDays} label="Sessions this week" value={dash.stats.sessionsThisWeek} coverage="scheduled and held" />
        <StatCard icon={UserX} label="No-show rate" value={`${dash.stats.noShowRate.rate}%`} coverage={dash.stats.noShowRate.window} />
        <StatCard icon={HeartPulse} label="Outcomes captured" value={dash.stats.outcomesCoverage.captured} coverage={coverageNote(dash.stats.outcomesCoverage.captured, dash.stats.outcomesCoverage.total, "measured")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Caseload by status" />
          <div className="space-y-3 px-[17px] pb-[17px]">
            {byStatus.map((b) => (
              <div key={b.status}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="inline-flex items-center gap-1.5 text-text-2">
                    <StatusDot tone={STATUS[b.status].tone} /> {STATUS[b.status].label}
                  </span>
                  <span className="font-semibold tabular-nums text-text">{b.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(b.count / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title={`Outcome trend (${dash.outcomes.tool})`} />
          <div className="px-[17px] pb-[17px]">
            <OutcomeSparkline
              points={dash.outcomes.points}
              tool={dash.outcomes.tool}
              coverage={coverageNote(dash.outcomes.coverage.captured, dash.outcomes.coverage.total, "clients measured")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
