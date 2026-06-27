import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { coverageNote } from "@/lib/mock/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AttentionList } from "@/components/dashboard/attention-list";

export const dynamic = "force-dynamic";

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

export default async function HubOverviewPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();

  const now = new Date().toISOString();
  const overview = await provider.getHubOverview(membership.orgId, now);
  if (!overview) notFound();

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/overview`,
    reason: "hub_oversight",
  });

  const firstName = principal.name.split(" ")[0];

  return (
    <div className="rise-stagger space-y-6">
      <PageHead
        title={`${greeting()}, ${firstName}`}
        summary={`${membership.orgName} at a glance — ${overview.clientsWeek} clients seen this week.`}
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label="Clients this week"
          value={overview.clientsWeek}
          coverage={`${overview.clientsToday} today · ${overview.clientsMonth} this month`}
        />
        <StatCard
          icon={TrendingUp}
          label="Income this month"
          value={rands(overview.incomeMonthCents)}
          coverage={`predicted ${rands(overview.incomePredictionCents)} by month end`}
        />
        <StatCard
          icon={UserX}
          label="No-show rate"
          value={`${overview.noShowRate}%`}
          coverage="this week"
        />
        <StatCard
          icon={ClipboardList}
          label="Open intakes"
          value={overview.openIntakes}
          coverage="awaiting a first session"
        />
        <StatCard
          icon={BadgeCheck}
          label="Credential checks"
          value={overview.pendingCredentials}
          coverage={overview.pendingCredentials === 0 ? "all verified" : "pending verification"}
        />
        <StatCard
          icon={CalendarDays}
          label="Outcomes captured"
          value={overview.outcomesCoverage.captured}
          coverage={coverageNote(overview.outcomesCoverage.captured, overview.outcomesCoverage.total, "clients measured")}
        />
      </div>

      <Card>
        <CardHead title="Needs attention" count={overview.attention.length} />
        <div className="px-[17px] pb-[17px]">
          <AttentionList items={overview.attention} />
        </div>
      </Card>
    </div>
  );
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
