import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { now as clockNow } from "@/lib/clock";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { coverageNote, isoWeekday } from "@/lib/domain/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { AttentionList } from "@/components/dashboard/attention-list";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const WEEK_CAPACITY = 25; // a full week of sessions before a counsellor is stretched

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function HubOverviewPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();

  const now = clockNow();
  const overview = await provider.getHubOverview(membership.orgId, now);
  if (!overview) notFound();

  // Staffing load  who's stretched, who has capacity (this week, Mon–Sun).
  const counsellors = await provider.listCounsellors(membership.orgId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sessionsByCounsellor = await Promise.all(counsellors.map((c) => provider.listCounsellorSessions(c.id, now)));
  const teamLoad = counsellors
    .map((c, i) => {
      const wk = (sessionsByCounsellor[i] ?? []).filter((s) => weekDates.some((d) => s.startsAt.startsWith(d)));
      const seen = wk.filter((s) => s.state === "completed" || s.state === "discharged").length;
      const upcoming = wk.filter((s) => s.state === "scheduled").length;
      return { c, total: wk.length, seen, upcoming, pct: Math.min(100, Math.round((wk.length / WEEK_CAPACITY) * 100)) };
    })
    .sort((a, b) => b.total - a.total);

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
        summary={`${membership.orgName} at a glance  ${overview.clientsWeek} clients seen this week.`}
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label="Clients this week"
          value={overview.clientsWeek}
          coverage={`${overview.clientsToday} today · ${overview.clientsMonth} this month`}
        />
        <StatCard
          icon={UserPlus}
          label="New clients this week"
          value={overview.newClientsWeek}
          coverage={`${overview.newClientsToday} today · ${overview.newClientsMonth} this month`}
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

      {/* Income  actual & predicted, day / week / month */}
      <Card>
        <CardHead title="Income  actual & predicted" />
        <div className="grid grid-cols-3 divide-x divide-border px-[17px] pb-[17px] pt-1">
          <IncomeCol label="Today" actual={rands(overview.income.todayCents)} predicted={rands(overview.income.predictedTodayCents)} />
          <IncomeCol label="This week" actual={rands(overview.income.weekCents)} predicted={rands(overview.income.predictedWeekCents)} />
          <IncomeCol label="This month" actual={rands(overview.incomeMonthCents)} predicted={rands(overview.incomePredictionCents)} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Team this week" count={teamLoad.length} />
          <div className="space-y-3 px-[17px] pb-[17px]">
            {teamLoad.map(({ c, total, seen, upcoming, pct }) => {
              const stretched = pct >= 80;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.name} size="sm" verified={c.credential.status === "verified"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-text">{c.name}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-text-3">{total} session{total === 1 ? "" : "s"}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className={cn("h-full rounded-full", stretched ? "bg-warn" : "bg-accent")} style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>
                      <CredentialChip body={c.credential.body} status={c.credential.status} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-3">{seen} seen · {upcoming} upcoming{stretched ? " · near capacity" : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead title="Needs attention" count={overview.attention.length} />
          <div className="px-[17px] pb-[17px]">
            <AttentionList items={overview.attention} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function IncomeCol({ label, actual, predicted }: { label: string; actual: string; predicted: string }) {
  return (
    <div className="px-4 first:pl-0">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-text-3">{label}</div>
      <div className="mt-1 text-[20px] font-bold tabular-nums tracking-[-0.02em] text-text">{actual}</div>
      <div className="mt-0.5 text-[11.5px] text-text-2">predicted {predicted}</div>
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
