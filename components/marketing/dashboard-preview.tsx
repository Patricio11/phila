import {
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  Users,
  UserX,
  Video,
} from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHead } from "@/components/ui/card";
import { OutcomeSparkline } from "@/components/charts/outcome-sparkline";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";

/**
 * A faithful, self-contained snapshot of the counsellor dashboard, built from
 * the same primitives the real app uses  so the landing genuinely shows the
 * product. Static data; no providers. Pointer events off so it reads as a
 * still of the app, not an interactive surface.
 */
const ROWS: {
  time: string;
  name: string;
  tone: DotTone;
  state: string;
  service: string;
  tag?: { label: string; online?: boolean };
  now?: boolean;
}[] = [
  { time: "08:30", name: "Lerato Mahlangu", tone: "green", state: "Completed", service: "Individual", tag: { label: "Consulting room 1" } },
  { time: "09:45", name: "Sipho Khumalo", tone: "blue", state: "In session", service: "Individual", tag: { label: "Consulting room 1" }, now: true },
  { time: "11:00", name: "Fatima Adams", tone: "grey", state: "Upcoming", service: "Assessment", tag: { label: "Online", online: true } },
];

export function DashboardPreview() {
  return (
    <div className="pointer-events-none flex select-none text-text" aria-hidden>
      {/* Slim sidebar rail */}
      <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-border bg-sidebar py-4 sm:flex">
        <BrandMark size={28} />
        <nav className="flex flex-col items-center gap-1.5">
          {[LayoutDashboard, CalendarDays, Users, NotebookPen, MessagesSquare].map((Icon, i) => (
            <span
              key={i}
              className={
                i === 0
                  ? "inline-flex size-8 items-center justify-center rounded-control bg-accent-soft text-accent"
                  : "inline-flex size-8 items-center justify-center rounded-control text-text-3"
              }
            >
              <Icon className="size-[17px]" strokeWidth={1.9} />
            </span>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="mb-4">
          <div className="text-[15px] font-[680] tracking-[-0.02em]">Good morning, Nomsa</div>
          <div className="text-[12px] text-text-3">You have 5 sessions today · 3 still to come.</div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatCard icon={Users} label="Clients today" value={5} coverage="1 seen · 3 to come" />
          <StatCard icon={CheckCircle2} label="Completed" value={1} coverage="of 5 today" />
          <StatCard icon={UserX} label="No-show rate" value="8%" coverage="this week" />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHead title="Today" count={5} />
            <div className="space-y-0.5 px-2.5 pb-2.5">
              {ROWS.map((r) => (
                <div key={r.time}>
                  {r.now && (
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-warn">Now · 09:52</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-warn/50 to-transparent" />
                    </div>
                  )}
                  <div className={`flex items-center gap-2.5 rounded-control px-2 py-2 ${r.now ? "bg-accent-soft" : ""}`}>
                    <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums">{r.time}</span>
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{r.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-2">
                        <StatusDot tone={r.tone} /> {r.state}
                        <span className="text-text-3">· {r.service}</span>
                      </div>
                    </div>
                    {r.tag ? (
                      <Tag tone={r.tag.online ? "online" : "neutral"}>
                        {r.tag.online ? <Video className="size-3" strokeWidth={2} /> : null}
                        {r.tag.label}
                      </Tag>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHead title="Outcomes" />
            <div className="px-3.5 pb-3.5">
              <OutcomeSparkline
                tool="PHQ-9"
                points={[
                  { label: "1", value: 18 },
                  { label: "2", value: 16 },
                  { label: "3", value: 14 },
                  { label: "4", value: 11 },
                  { label: "5", value: 9 },
                ]}
                coverage="38 of 52 clients measured"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
