import {
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderClosed,
  HandCoins,
  LayoutDashboard,
  LineChart,
  MessagesSquare,
  Phone,
  ReceiptText,
  Users,
  Video,
} from "lucide-react";
import { PhilaMark } from "@/components/brand/logo";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";

/**
 * A faithful, self-contained snapshot of the ORG ADMIN's hub, built from the
 * same primitives the real app uses - so the landing genuinely shows the
 * product at practice level: the whole team's day, practice stats, the client
 * conversation with its typing indicator, who's on duty, and a session note
 * filing itself into the client's folder. Static data; pointer events off so
 * it reads as a still of the app, not an interactive surface.
 */
const ROWS: {
  time: string;
  name: string;
  tone: DotTone;
  state: string;
  counsellor: string;
  tag?: { label: string; kind?: "online" | "phone" };
  now?: boolean;
}[] = [
  { time: "08:30", name: "Lerato Mahlangu", tone: "green", state: "Completed", counsellor: "Nomsa", tag: { label: "Room 1" } },
  { time: "09:45", name: "Sipho Khumalo", tone: "blue", state: "In session", counsellor: "Thabo", tag: { label: "Room 2" }, now: true },
  { time: "11:00", name: "Fatima Adams", tone: "grey", state: "Upcoming", counsellor: "Aisha", tag: { label: "Online", kind: "online" } },
  { time: "13:30", name: "Johan Botha", tone: "grey", state: "Upcoming", counsellor: "Nomsa", tag: { label: "Phone", kind: "phone" } },
];

const TEAM: { name: string; line: string; tone: DotTone }[] = [
  { name: "Nomsa Dlamini", line: "In session · Room 1", tone: "blue" },
  { name: "Thabo Mokoena", line: "Online now", tone: "green" },
  { name: "Aisha Patel", line: "Next session 11:00", tone: "grey" },
];

/* The hub rail: Overview · Appointments · Clients · Insights · Funders · Messages · Documents · Invoicing */
const NAV = [LayoutDashboard, CalendarDays, Users, LineChart, HandCoins, MessagesSquare, FolderClosed, ReceiptText];

export function DashboardPreview() {
  return (
    <div className="pointer-events-none flex select-none text-text" aria-hidden>
      {/* Slim sidebar rail */}
      <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-border bg-sidebar py-4 sm:flex">
        <PhilaMark size={28} />
        <nav className="flex flex-col items-center gap-1.5">
          {NAV.map((Icon, i) => (
            <span
              key={i}
              className={
                i === 0
                  ? "inline-flex size-8 items-center justify-center rounded-control bg-accent-soft text-accent"
                  : "relative inline-flex size-8 items-center justify-center rounded-control text-text-3"
              }
            >
              <Icon className="size-[17px]" strokeWidth={1.9} />
              {Icon === MessagesSquare && (
                <span className="absolute right-0.5 top-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-semibold text-accent-ink">2</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Content - the practice at a glance */}
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="mb-4">
          <div className="text-[15px] font-[680] tracking-[-0.02em]">Good morning, Thandeka</div>
          <div className="text-[12px] text-text-3">Masizakhe Counselling · 18 sessions today across 5 counsellors.</div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatCard icon={Users} label="Sessions today" value={18} coverage="6 done · 12 to come" />
          <StatCard icon={CheckCircle2} label="Attendance" value="94%" coverage="this week" />
          <StatCard icon={ReceiptText} label="Paid this month" value="R48 250" coverage="3 invoices open" />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHead title="Across the practice" count={18} />
            <div className="space-y-0.5 px-2.5 pb-2.5">
              {ROWS.map((r) => (
                <div key={r.time}>
                  {r.now && (
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-warn">Now · 09:52</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-warn/50 to-transparent" />
                    </div>
                  )}
                  <div className={`flex items-center gap-2.5 rounded-control px-2 py-1.5 ${r.now ? "bg-accent-soft" : ""}`}>
                    <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums">{r.time}</span>
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{r.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-text-2">
                        <StatusDot tone={r.tone} /> {r.state}
                        <span className="text-text-3">· {r.counsellor}</span>
                      </div>
                    </div>
                    {r.tag ? (
                      <Tag tone={r.tag.kind === "online" ? "online" : "neutral"}>
                        {r.tag.kind === "online" ? <Video className="size-3" strokeWidth={2} /> : r.tag.kind === "phone" ? <Phone className="size-3" strokeWidth={2} /> : null}
                        {r.tag.label}
                      </Tag>
                    ) : null}
                  </div>
                </div>
              ))}
              {/* The session note filed itself into the client's folder */}
              <div className="mx-2 mt-1 flex items-center gap-2 rounded-control border border-accent/25 bg-accent-soft/40 px-2.5 py-1.5">
                <FileText className="size-3.5 shrink-0 text-accent" strokeWidth={2} />
                <span className="min-w-0 flex-1 truncate text-[11px] text-text-2">
                  Session note <span className="font-semibold text-text">SN-0830-LM</span>{" "}filed to Lerato&apos;s folder
                </span>
                <CheckCircle2 className="size-3.5 shrink-0 text-accent" strokeWidth={2.2} />
              </div>
            </div>
          </Card>

          <div className="space-y-3 lg:col-span-2">
            {/* The client conversation - typing indicator and all */}
            <Card>
              <CardHead title="Messages" />
              <div className="space-y-2 px-3.5 pb-3.5">
                <div className="flex items-center gap-2">
                  <Avatar name="Lerato Mahlangu" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[12px] font-medium">
                      Lerato Mahlangu
                      <span className="rounded-full bg-sky-100 px-1.5 text-[9px] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">Client</span>
                    </div>
                    <div className="text-[10.5px] text-accent">typing…</div>
                  </div>
                </div>
                <div className="max-w-[85%] rounded-2xl bg-surface-2 px-3 py-1.5 text-[11.5px]">Thank you for today - the steps really help.</div>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-accent px-3 py-1.5 text-[11.5px] text-accent-ink">See you Wednesday 🌿</div>
                <div className="flex items-center gap-1 pl-1">
                  <span className="size-1 animate-bounce rounded-full bg-text-3 [animation-delay:0ms]" />
                  <span className="size-1 animate-bounce rounded-full bg-text-3 [animation-delay:150ms]" />
                  <span className="size-1 animate-bounce rounded-full bg-text-3 [animation-delay:300ms]" />
                </div>
              </div>
            </Card>

            {/* Who's on duty right now - presence, org-level */}
            <Card>
              <CardHead title="Team" />
              <div className="space-y-1.5 px-3 pb-3">
                {TEAM.map((t) => (
                  <div key={t.name} className="flex items-center gap-2.5 rounded-control px-1 py-0.5">
                    <Avatar name={t.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium">{t.name}</div>
                      <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[10.5px] text-text-2">
                        <StatusDot tone={t.tone} /> {t.line}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
