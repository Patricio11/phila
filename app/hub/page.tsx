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
import { RoomsRightNow } from "@/components/dashboard/rooms-right-now";
import { roomsRightNowDb, type RoomNow } from "@/db/queries/room-assignments";
import { TeamThisWeek } from "@/components/dashboard/team-this-week";
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
  const roomsNow: RoomNow[] = process.env.DATA_PROVIDER === "db" ? await roomsRightNowDb(membership.orgId, now) : [];
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

      {/* One calm grid: every widget the same height, content scrolls inside -
          the page stays a dashboard, never a long feed. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <ComingUpNext upcoming={dashboard.upcoming} className={WIDGET_H} />

        <Card className={cn("flex flex-col", WIDGET_H)}>
          <CardHead title="Activity feed" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActivityFeed activity={dashboard.activity} />
          </div>
        </Card>

        <TeamThisWeek
          className={WIDGET_H}
          rows={teamLoad.map(({ c, total, seen, upcoming, pct }) => ({
            id: c.id, name: c.name, total, seen, upcoming, pct,
            credentialBody: c.credential.body, credentialStatus: c.credential.status,
          }))}
        />

        <Card className={cn("flex flex-col", WIDGET_H)}>
          <CardHead title="Needs attention" count={overview.attention.length} />
          <div className="min-h-0 flex-1 overflow-y-auto px-[17px] pb-[17px]">
            <AttentionList items={overview.attention} />
          </div>
        </Card>

        <RoomsRightNow rooms={roomsNow} className={WIDGET_H} />
      </div>
    </div>
  );
}

/** Every dashboard widget shares this height; long content scrolls inside. */
const WIDGET_H = "h-[380px]";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
