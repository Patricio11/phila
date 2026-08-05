import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { now as clockNow } from "@/lib/clock";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { getCreditBalances } from "@/db/queries/messaging";
import { LOW_CREDIT_THRESHOLD } from "@/lib/payments/packs";
import { logAccess } from "@/lib/audit";
import { isoWeekday, WEEK_CAPACITY } from "@/lib/domain/helpers";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { HubDashboardStats } from "@/components/dashboard/hub-dashboard-stats";
import { ComingUpNext } from "@/components/dashboard/coming-up-next";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { getHubDashboardDb } from "@/db/queries/hub-dashboard";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { AttentionList } from "@/components/dashboard/attention-list";
import { VerificationBanner } from "@/components/hub/verification-banner";
import { getOnboardingStatusDb } from "@/db/queries/onboarding";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  const org = await provider.getOrg(membership.orgId);

  const credits = await getCreditBalances(membership.orgId);
  const dashboard = await getHubDashboardDb(membership.orgId, now);
  const lowCredits = (["sms", "email"] as const).filter((c) => credits[c] < LOW_CREDIT_THRESHOLD);

  // Verification gate  a nudge (not a wall) until the practice is verified.
  const onboardingStatus = process.env.DATA_PROVIDER === "db" ? await getOnboardingStatusDb(membership.orgId) : "verified";

  // Staffing load  who's stretched, who has capacity (this week, Mon–Sun).
  const counsellors = await provider.listCounsellors(membership.orgId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sessionsByCounsellor = await Promise.all(counsellors.map((c) => provider.listCounsellorSessions(membership.orgId, c.id, now)));
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

      <VerificationBanner status={onboardingStatus} />

      {lowCredits.length > 0 && (
        <Link href="/hub/billing" className="flex items-center gap-2.5 rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-[13px] text-warn transition-colors hover:bg-warn-soft/70">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="flex-1">Low on <b>{lowCredits.join(" & ")}</b> credits  top up so reminders and confirmations keep going out.</span>
          <span className="shrink-0 font-medium underline-offset-2 hover:underline">Top up →</span>
        </Link>
      )}

      <HubDashboardStats data={dashboard} paymentsOn={Boolean(org?.features.payments)} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Coming up next" count={dashboard.upcoming.length} />
          <ComingUpNext upcoming={dashboard.upcoming} />
        </Card>
        <Card>
          <CardHead title="Activity feed" />
          <ActivityFeed activity={dashboard.activity} />
        </Card>
      </div>

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

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
