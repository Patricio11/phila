import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Users, UserX } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { coverageNote } from "@/lib/mock/helpers";
import { PageHead } from "@/components/shell/page-head";
import { CreateAppointmentButton } from "@/components/scheduling/create-appointment-button";
import { Card, CardBody, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ScheduleList } from "@/components/schedule/schedule-list";
import { AttentionList } from "@/components/dashboard/attention-list";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";

// Session-specific and time-sensitive ("today" must always be the real day), so
// this renders per request rather than freezing at build time. In Part B the
// auth/session read makes it inherently dynamic.
export const dynamic = "force-dynamic";

/** The counsellor's Today  the approved dashboard, the living reference build. */
export default async function DashboardPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = new Date().toISOString();
  const dash = await provider.getCounsellorDashboard(me.id, now);
  if (!dash) notFound();

  const [allClients, services, rooms] = await Promise.all([
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);
  const scheduling = {
    orgId: membership.orgId,
    defaultCounsellorId: me.id,
    clients: allClients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
  };

  // Reading one's own caseload is permitted  and still recorded (Protected & Audited Rule).
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `counsellor:${me.id}/dashboard`,
    reason: "own_caseload",
  });

  const { stats } = dash;
  const nowMs = new Date(now).getTime();
  const remaining = dash.today.filter(
    (a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled",
  ).length;

  const firstName = principal.name.split(" ")[0];

  return (
    <div className="rise-stagger space-y-6">
      <PageHead
        title={`${greeting()}, ${firstName}`}
        summary={
          dash.today.length === 0
            ? "Your day is clear."
            : `You have ${dash.today.length} ${plural(dash.today.length, "session")} today · ${remaining} still to come.`
        }
        actions={<CreateAppointmentButton options={scheduling} />}
      />

      {/* Stat cards  honest coverage, no vanity numbers, no fabricated trends. */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Clients today"
          value={stats.clientsToday}
          coverage={`${stats.completedToday} seen · ${remaining} to come`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed today"
          value={stats.completedToday}
          coverage={coverageNote(stats.completedToday, dash.today.length, "of today")}
        />
        <StatCard
          icon={CalendarDays}
          label="Sessions this week"
          value={stats.sessionsThisWeek}
          coverage="scheduled and held"
        />
        <StatCard
          icon={UserX}
          label="No-show rate"
          value={`${stats.noShowRate.rate}%`}
          coverage={stats.noShowRate.window}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <CardHead title="Today" count={dash.today.length} />
          <CardBody className="pt-0">
            <ScheduleList appointments={dash.today} nowISO={now} />
          </CardBody>
        </Card>

        {/* Outcomes + attention */}
        <div className="space-y-6">
          <Card>
            <CardHead title="Outcomes" />
            <CardBody className="pt-0">
              <OutcomeSparkline
                points={dash.outcomes.points}
                tool={dash.outcomes.tool}
                coverage={coverageNote(
                  dash.outcomes.coverage.captured,
                  dash.outcomes.coverage.total,
                  "clients measured",
                )}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Needs attention" count={dash.attention.length} />
            <CardBody className="pt-0">
              <AttentionList items={dash.attention} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
