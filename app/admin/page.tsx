import Link from "next/link";
import { Activity, Blocks, Bot, Building2, TrendingUp, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusDot } from "@/components/ui/status-dot";

export const dynamic = "force-dynamic";

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}
function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function AdminOverviewPage() {
  const principal = await requireSuperAdmin();
  const provider = await getDataProvider();

  const [overview, orgs, audit] = await Promise.all([
    provider.getPlatformOverview(),
    provider.listPlatformOrgs(),
    provider.listPlatformAudit(),
  ]);

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: "platform/overview",
    reason: "console_open",
  });

  const attention = orgs.filter((o) => o.org.subscriptionStatus === "past_due" || o.org.suspended);

  return (
    <div className="rise-stagger space-y-6">
      <PageHead title="Platform" summary="Every org, plan, and rail across Phila." />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <StatCard icon={Building2} label="Organisations" value={overview.orgCount} coverage={`${overview.activeOrgs} active · ${overview.trialingOrgs} trial · ${overview.suspendedOrgs} suspended`} />
        <StatCard icon={TrendingUp} label="MRR" value={rands(overview.mrrCents)} coverage="monthly recurring revenue" />
        <StatCard icon={Users} label="Team members" value={overview.totalMembers} coverage="across all orgs" />
        <StatCard icon={Activity} label="Sessions" value={overview.sessions7d} coverage="last 7 days" />
        <StatCard icon={Bot} label="AI spend" value={rands(overview.aiSpendCents)} coverage="this month · platform-fronted" />
        <StatCard icon={Blocks} label="Integrations live" value={overview.integrationHealth.live} coverage={`${overview.integrationHealth.mock} mock · ${overview.integrationHealth.off} off`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Needs attention" count={attention.length} />
          <div className="space-y-2 px-[17px] pb-[17px]">
            {attention.length === 0 ? (
              <p className="text-[12.5px] text-text-3">Every org is in good standing.</p>
            ) : (
              attention.map(({ org }) => (
                <Link key={org.id} href="/admin/orgs" className="flex items-center justify-between gap-3 rounded-control border border-border p-3 transition-colors hover:bg-surface-hover">
                  <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-text">
                    <StatusDot tone={org.suspended ? "grey" : "amber"} /> {org.name}
                  </span>
                  <span className="text-[12px] text-text-2">{org.suspended ? "Suspended" : "Payment past due"}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Recent platform activity" action={<Link href="/admin/audit" className="text-[12.5px] font-medium text-accent hover:underline">Open audit</Link>} />
          <div className="space-y-1.5 px-[17px] pb-[17px]">
            {audit.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-text-2">
                  <span className="font-medium text-text">{e.action}</span> · {e.orgName ?? "platform"}
                </span>
                <span className="shrink-0 text-text-3">{timeAgo(e.at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
