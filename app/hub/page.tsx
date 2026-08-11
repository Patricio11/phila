import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { now as clockNow } from "@/lib/clock";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider, type AppointmentView } from "@/lib/data-provider";
import { getCreditBalances } from "@/db/queries/messaging";
import { LOW_CREDIT_THRESHOLD } from "@/lib/payments/packs";
import { logAccess } from "@/lib/audit";
import { WEEK_CAPACITY } from "@/lib/domain/helpers";
import { PageHead } from "@/components/shell/page-head";
import { HubPeriodDashboard } from "@/components/dashboard/hub-period-dashboard";
import { periodWindows, inWindow } from "@/lib/dashboard/periods";
import type { DashPeriod, UpcomingRow, ActivityRow } from "@/db/queries/hub-dashboard";
import { getHubDashboardDb } from "@/db/queries/hub-dashboard";
import { roomsRightNowDb, type RoomNow } from "@/db/queries/room-assignments";
import type { TeamLoadRow } from "@/components/dashboard/team-this-week";
import { VerificationBanner } from "@/components/hub/verification-banner";
import { getOnboardingStatusDb } from "@/db/queries/onboarding";

export const dynamic = "force-dynamic";

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

  // Batch 2m - ONE period filter drives the tiles AND every widget beneath them.
  // Each period's slice is computed here so switching is instant on the client.
  const counsellors = await provider.listCounsellors(membership.orgId);
  const [sessionsByCounsellor, services, rooms] = await Promise.all([
    Promise.all(counsellors.map((c) => provider.listCounsellorSessions(membership.orgId, c.id, now))),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  const windows = periodWindows(now);
  const PERIOD_KEYS: DashPeriod[] = ["today", "week", "month", "lastMonth"];
  const nowMs = new Date(now).getTime();

  const teamByPeriod = {} as Record<DashPeriod, TeamLoadRow[]>;
  const upcomingByPeriod = {} as Record<DashPeriod, UpcomingRow[]>;
  const activityByPeriod = {} as Record<DashPeriod, ActivityRow[]>;
  for (const key of PERIOD_KEYS) {
    const w = windows[key];
    // Team: sessions inside the window, per counsellor. Capacity scales with the
    // window so the bar stays meaningful (a day is a fifth of a working week).
    const capacity = key === "today" ? Math.max(1, Math.round(WEEK_CAPACITY / 5)) : key === "week" ? WEEK_CAPACITY : WEEK_CAPACITY * 4;
    teamByPeriod[key] = counsellors
      .map((c, i) => {
        const inPeriod = (sessionsByCounsellor[i] ?? []).filter((sn) => inWindow(sn.startsAt, w));
        const seen = inPeriod.filter((sn) => sn.state === "completed" || sn.state === "discharged").length;
        const upcoming = inPeriod.filter((sn) => sn.state === "scheduled").length;
        return {
          id: c.id, name: c.name, total: inPeriod.length, seen, upcoming,
          pct: Math.min(100, Math.round((inPeriod.length / capacity) * 100)),
          credentialBody: c.credential.body, credentialStatus: c.credential.status,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Coming up: sessions inside the window. For a window that includes now, only
    // what is still ahead ("coming up"); for a past window, what happened in it.
    upcomingByPeriod[key] = dashboard.periodUpcoming
      .filter((u) => inWindow(u.startsAt, w) && (w.to.getTime() < nowMs || new Date(u.startsAt).getTime() >= nowMs))
      .slice(0, 20);

    activityByPeriod[key] = dashboard.activity.filter((a) => inWindow(a.at, w)).slice(0, 40);
  }

  // The full appointment behind every row shown by any period, so clicking one
  // opens it in place. These are already in hand - no second fetch.
  const shownIds = new Set(Object.values(upcomingByPeriod).flat().map((u) => u.id));
  const apptDetails: Record<string, AppointmentView> = {};
  for (const view of sessionsByCounsellor.flat()) {
    if (shownIds.has(view.id)) apptDetails[view.id] = view;
  }

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

      <HubPeriodDashboard
        data={dashboard}
        paymentsOn={Boolean(org?.features.payments)}
        upcomingByPeriod={upcomingByPeriod}
        activityByPeriod={activityByPeriod}
        teamByPeriod={teamByPeriod}
        attention={overview.attention}
        rooms={roomsNow}
        apptDetails={apptDetails}
        scheduling={{
          orgId: membership.orgId,
          clients: [],
          services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
          counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
          rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
          defaultDurationMin: org?.scheduling.defaultDurationMin ?? 50,
          businessHours: org?.scheduling.businessHours ?? { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
        }}
      />
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
