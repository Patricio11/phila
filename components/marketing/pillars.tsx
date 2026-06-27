import { Check } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";
import { CalendarDays, DoorOpen, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Three pillars, asymmetric, each illustrated by a real product fragment. */
export function Pillars() {
  return (
    <section className="bg-surface-2/40 py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-20 px-4 sm:px-6">
        <Pillar
          eyebrow="The day, held"
          title="Every counsellor's day, calm and in one place"
          points={[
            "Calendar, caseload, and the session you're in  no hunting.",
            "Live in-session notes that autosave and never block.",
            "Mark done, no-show, or postponed; the thread just updates.",
          ]}
          visual={<DayVisual />}
        />
        <Pillar
          reverse
          eyebrow="The org, in view"
          title="Programme-grade oversight the incumbents can't show"
          points={[
            "Every counsellor's calendar, rooms, and utilisation at a glance.",
            "Intake, invoicing, and team roles with honest permissions.",
            "Income prediction and no-show rate from the real schedule.",
          ]}
          visual={<OrgVisual />}
        />
        <Pillar
          eyebrow="Proof, without the second job"
          title="Funder and demographic reporting that writes itself"
          points={[
            "Indicators roll up live from the clinical work  no double entry.",
            "Consent-gated, k-anonymised, audited  nothing identifiable.",
            "One click to the funder's template; the report is just there.",
          ]}
          visual={<ProofVisual />}
        />
      </div>
    </section>
  );
}

function Pillar({
  eyebrow,
  title,
  points,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <Reveal className={cn(reverse && "lg:order-2")}>
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-accent">
          {eyebrow}
        </span>
        <h3 className="mt-3 text-[clamp(1.4rem,2.8vw,2rem)] font-[680] leading-[1.15] tracking-[-0.03em] text-text">
          {title}
        </h3>
        <ul className="mt-5 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[14.5px] leading-relaxed text-text-2">
              <span className="mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Check className="size-3" strokeWidth={2.6} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={120} className={cn(reverse && "lg:order-1")}>
        <div className="rounded-[14px] border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
          {visual}
        </div>
      </Reveal>
    </div>
  );
}

/* ---- In-product fragments -------------------------------------------- */

function DayVisual() {
  const rows = [
    { time: "08:30", name: "Lerato Mahlangu", tone: "green" as const, state: "Completed", room: "Room 1" },
    { time: "09:45", name: "Sipho Khumalo", tone: "blue" as const, state: "In session", room: "Room 1", now: true },
    { time: "11:00", name: "Fatima Adams", tone: "grey" as const, state: "Upcoming", online: true },
  ];
  return (
    <Card>
      <CardHead title="Today" count={5} />
      <div className="space-y-0.5 px-2.5 pb-2.5">
        {rows.map((r) => (
          <div
            key={r.time}
            className={cn(
              "flex items-center gap-2.5 rounded-control px-2 py-2",
              r.now && "bg-accent-soft",
            )}
          >
            <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums text-text">
              {r.time}
            </span>
            <Avatar name={r.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-text">{r.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-2">
                <StatusDot tone={r.tone} /> {r.state}
              </div>
            </div>
            <Tag tone={r.online ? "online" : "neutral"}>{r.online ? "Online" : r.room}</Tag>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OrgVisual() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Users} label="Clients this week" value={184} coverage="across 6 counsellors" />
        <StatCard icon={CalendarDays} label="No-show rate" value="6%" coverage="this month" />
        <StatCard icon={DoorOpen} label="Room use" value="72%" coverage="2 sites" />
      </div>
      <Card>
        <CardHead title="Calendars" />
        <div className="space-y-1.5 px-3.5 pb-3.5">
          {[
            { name: "Nomsa Dlamini", fill: 82, c: "var(--accent)" },
            { name: "Thabo Mokoena", fill: 64, c: "var(--info)" },
            { name: "Aisha Patel", fill: 48, c: "#9a6418" },
          ].map((l) => (
            <div key={l.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-[11.5px] text-text-2">{l.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full" style={{ width: `${l.fill}%`, background: l.c }} />
              </span>
              <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-text-3">{l.fill}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProofVisual() {
  const indicators = [
    { label: "Unique clients reached", actual: 312, target: 300, status: "on" as const },
    { label: "Female participants", actual: 58, target: 60, unit: "%", status: "risk" as const },
    { label: "Improved ≥5 on PHQ-9", actual: 71, target: 70, unit: "%", status: "on" as const },
  ];
  return (
    <Card>
      <CardHead title="Grant indicators" action={<Tag tone="accent">k-anon · audited</Tag>} />
      <div className="space-y-3.5 px-3.5 pb-4">
        {indicators.map((ind) => {
          const pct = Math.min(100, Math.round((ind.actual / ind.target) * 100));
          return (
            <div key={ind.label}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-2">{ind.label}</span>
                <span className="font-semibold tabular-nums text-text">
                  {ind.actual}
                  {ind.unit ?? ""} <span className="font-normal text-text-3">/ {ind.target}{ind.unit ?? ""}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn("h-full rounded-full", ind.status === "on" ? "bg-accent" : "bg-warn")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-text-3">Small cells suppressed  a funder can never re-identify a client.</p>
      </div>
    </Card>
  );
}
