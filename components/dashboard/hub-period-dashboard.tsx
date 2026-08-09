"use client";

import { useState } from "react";
import type { DashPeriod, HubDashboard, UpcomingRow, ActivityRow } from "@/db/queries/hub-dashboard";
import type { AttentionItem } from "@/lib/data-provider";
import type { RoomNow } from "@/db/queries/room-assignments";
import { DASH_PERIODS } from "@/lib/dashboard/periods";
import { Card, CardHead } from "@/components/ui/card";
import { HubDashboardStats } from "@/components/dashboard/hub-dashboard-stats";
import { ComingUpNext } from "@/components/dashboard/coming-up-next";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AttentionList } from "@/components/dashboard/attention-list";
import { RoomsRightNow } from "@/components/dashboard/rooms-right-now";
import { TeamThisWeek, type TeamLoadRow } from "@/components/dashboard/team-this-week";

/** Every dashboard widget shares this height; long content scrolls inside. */
const WIDGET_H = "h-[380px]";

/**
 * One period, one dashboard. The Today / This week / This month / Last month
 * filter now drives the stat tiles AND the widgets beneath them - each period's
 * slice is computed server-side up front, so switching is instant with no
 * refetch. "Needs attention" stays unfiltered on purpose: a safeguarding flag
 * or a pending credential is a standing state, not a thing that happened in a
 * window - hiding it behind a date filter would be dangerous, so the card says
 * so plainly.
 */
export function HubPeriodDashboard({
  data,
  paymentsOn,
  upcomingByPeriod,
  activityByPeriod,
  teamByPeriod,
  attention,
  rooms,
}: {
  data: HubDashboard;
  paymentsOn: boolean;
  upcomingByPeriod: Record<DashPeriod, UpcomingRow[]>;
  activityByPeriod: Record<DashPeriod, ActivityRow[]>;
  teamByPeriod: Record<DashPeriod, TeamLoadRow[]>;
  attention: AttentionItem[];
  rooms: RoomNow[];
}) {
  const [period, setPeriod] = useState<DashPeriod>("week");
  const periodLabel = DASH_PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  return (
    <>
      <HubDashboardStats data={data} paymentsOn={paymentsOn} period={period} onPeriod={setPeriod} />

      {/* One calm grid: every widget the same height, content scrolls inside. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <ComingUpNext upcoming={upcomingByPeriod[period]} className={WIDGET_H} periodLabel={periodLabel} />

        <Card className={`flex flex-col ${WIDGET_H}`}>
          <CardHead title="Activity feed" action={<span className="text-[11.5px] text-text-3">{periodLabel}</span>} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActivityFeed activity={activityByPeriod[period]} periodLabel={periodLabel} />
          </div>
        </Card>

        <TeamThisWeek rows={teamByPeriod[period]} className={WIDGET_H} periodLabel={periodLabel} />

        <Card className={`flex flex-col ${WIDGET_H}`}>
          <CardHead
            title="Needs attention"
            count={attention.length}
            action={<span className="text-[11.5px] text-text-3">always current</span>}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-[17px] pb-[17px]">
            <AttentionList items={attention} />
          </div>
        </Card>

        <RoomsRightNow rooms={rooms} className={WIDGET_H} />
      </div>
    </>
  );
}
