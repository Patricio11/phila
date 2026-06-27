"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, NotebookPen, Search, UserX, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const DOT: Record<AppointmentState, DotTone> = {
  scheduled: "grey", completed: "green", no_show: "amber", cancelled: "grey",
  rescheduled: "grey", postponed: "amber", discharged: "green", risk_flagged: "rose",
};
const WORD: Record<AppointmentState, string> = {
  scheduled: "Upcoming", completed: "Completed", no_show: "No-show", cancelled: "Cancelled",
  rescheduled: "Rescheduled", postponed: "Postponed", discharged: "Completed", risk_flagged: "Safeguarding",
};

type Tab = "upcoming" | "recent" | "all";

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function SessionsList({ sessions, nowISO }: { sessions: AppointmentView[]; nowISO: string }) {
  const nowMs = new Date(nowISO).getTime();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowISO));
  const [tab, setTab] = useState<Tab>("upcoming");
  const [query, setQuery] = useState("");

  const isUpcoming = (s: AppointmentView) => new Date(s.startsAt).getTime() > nowMs && s.state === "scheduled";
  const upcomingCount = sessions.filter(isUpcoming).length;
  const todayCount = sessions.filter((s) => s.startsAt.startsWith(today) && s.state !== "cancelled").length;
  const completed = sessions.filter((s) => s.state === "completed" || s.state === "discharged").length;
  const noShows = sessions.filter((s) => s.state === "no_show").length;

  const rows = useMemo(() => {
    const base = sessions
      .filter((s) => (tab === "upcoming" ? isUpcoming(s) : tab === "recent" ? !isUpcoming(s) : true))
      .filter((s) => s.clientName.toLowerCase().includes(query.trim().toLowerCase()));
    return base.sort((a, b) => (tab === "upcoming" ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, tab, query, nowMs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={NotebookPen} value={upcomingCount} label="Upcoming" />
        <StatCard icon={CalendarDays} value={todayCount} label="Today" />
        <StatCard icon={CheckCircle2} value={completed} label="Completed" />
        <StatCard icon={UserX} value={noShows} label="No-shows" tone={noShows > 0 ? "warn" : "default"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-control border border-border p-0.5">
          {(["upcoming", "recent", "all"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("h-8 rounded-[6px] px-3 text-[12.5px] font-medium capitalize transition-colors", tab === t ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}>{t}</button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients…" className="h-9 w-full rounded-control border border-border bg-surface pl-8 pr-2 text-[13px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" />
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((s) => (
            <Link key={s.id} href={`/app/sessions/${s.id}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5 transition-colors hover:bg-surface-hover">
              <Avatar name={s.clientName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13.5px] font-medium text-text">{s.clientName}</span>
                  {s.type === "online" ? (
                    <Tag tone="online"><Video className="size-3" strokeWidth={2} aria-hidden /> Online</Tag>
                  ) : s.roomName ? (
                    <Tag tone="neutral">{s.roomName}</Tag>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-3">
                  <StatusDot tone={DOT[s.state]} /> {WORD[s.state]} · {s.serviceName} · {timeLabel(s.startsAt)}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-2">
          <EmptyState icon={NotebookPen} title={query ? "No matches" : tab === "upcoming" ? "Nothing upcoming" : "No sessions"} body={query ? "Try a different name." : "Sessions will appear here."} />
        </Card>
      )}
    </div>
  );
}
