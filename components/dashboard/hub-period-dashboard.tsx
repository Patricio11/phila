"use client";

import { useState } from "react";
import type { DashPeriod, HubDashboard, UpcomingRow, ActivityRow } from "@/db/queries/hub-dashboard";
import type { AppointmentView } from "@/lib/data-provider";
import type { RoomNow } from "@/db/queries/room-assignments";
import { DASH_PERIODS } from "@/lib/dashboard/periods";
import { Card, CardHead } from "@/components/ui/card";
import { HubDashboardStats } from "@/components/dashboard/hub-dashboard-stats";
import { ComingUpNext } from "@/components/dashboard/coming-up-next";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { RoomsRightNow } from "@/components/dashboard/rooms-right-now";
import { TeamThisWeek, type TeamLoadRow } from "@/components/dashboard/team-this-week";
import type { SchedulingOptions } from "@/components/scheduling/create-appointment-modal";

/** Every dashboard widget shares this height; long content scrolls inside. */
const WIDGET_H = "h-[380px]";

/**
 * One period, one dashboard. The Today / This week / This month / Last month
 * filter now drives the stat tiles AND the widgets beneath them - each period's
 * slice is computed server-side up front, so switching is instant with no
 * refetch. Batch 3m: "Needs attention" left this dashboard (the org acts on
 * flags where they live); Rooms right now holds the fourth slot.
 */
export function HubPeriodDashboard({
  data,
  paymentsOn,
  upcomingByPeriod,
  activityByPeriod,
  teamByPeriod,
  rooms,
  apptDetails,
  scheduling,
}: {
  data: HubDashboard;
  paymentsOn: boolean;
  upcomingByPeriod: Record<DashPeriod, UpcomingRow[]>;
  activityByPeriod: Record<DashPeriod, ActivityRow[]>;
  teamByPeriod: Record<DashPeriod, TeamLoadRow[]>;
  rooms: RoomNow[];
  /** Full appointments behind the "Coming up next" rows, keyed by id. */
  apptDetails: Record<string, AppointmentView>;
  /** Batch 2v - lets the opened appointment be edited in place. */
  scheduling?: SchedulingOptions;
}) {
  const [period, setPeriod] = useState<DashPeriod>("week");
  const periodLabel = DASH_PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  return (
    <>
      <HubDashboardStats data={data} paymentsOn={paymentsOn} period={period} onPeriod={setPeriod} />

      {/* One calm grid: every widget the same height, content scrolls inside. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <ComingUpNext upcoming={upcomingByPeriod[period]} className={WIDGET_H} periodLabel={periodLabel} details={apptDetails} scheduling={scheduling} />

        <Card className={`flex flex-col ${WIDGET_H}`}>
          <CardHead title="Activity feed" action={<span className="text-[11.5px] text-text-3">{periodLabel}</span>} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActivityFeed activity={activityByPeriod[period]} periodLabel={periodLabel} />
          </div>
        </Card>

        <TeamThisWeek rows={teamByPeriod[period]} className={WIDGET_H} periodLabel={periodLabel} />

        {/* Batch 3m - "Needs attention" left the org dashboard (safeguarding
            flags live where they're acted on); Rooms took its slot. */}
        <RoomsRightNow rooms={rooms} className={WIDGET_H} />
      </div>
    </>
  );
}
