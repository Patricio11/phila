import { CalendarCheck, CalendarX, CircleSlash, Activity, FileText, Sprout, TrendingDown, TrendingUp } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { OutcomeMeasure, ClientDocument, CarePlan } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Tone = "accent" | "danger" | "warn" | "info" | "neutral";
interface TimelineEvent {
  at: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: Tone;
  title: string;
  detail?: string;
}

const TONE: Record<Tone, { dot: string; ring: string }> = {
  accent: { dot: "bg-accent text-accent-ink", ring: "ring-accent/25" },
  danger: { dot: "bg-danger text-white", ring: "ring-danger/25" },
  warn: { dot: "bg-warn text-white", ring: "ring-warn/25" },
  info: { dot: "bg-info text-white", ring: "ring-info/25" },
  neutral: { dot: "bg-surface-2 text-text-3", ring: "ring-border" },
};

const SESSION_META: Record<string, { icon: TimelineEvent["icon"]; tone: Tone; label: string }> = {
  completed: { icon: CalendarCheck, tone: "accent", label: "Session completed" },
  discharged: { icon: CalendarCheck, tone: "accent", label: "Session completed" },
  scheduled: { icon: CalendarCheck, tone: "info", label: "Session booked" },
  risk_flagged: { icon: CalendarCheck, tone: "danger", label: "Session · safeguarding flagged" },
  no_show: { icon: CalendarX, tone: "warn", label: "No-show" },
  cancelled: { icon: CircleSlash, tone: "neutral", label: "Session cancelled" },
  postponed: { icon: CircleSlash, tone: "neutral", label: "Session postponed" },
};

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function monthKey(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Unified client timeline (W7) — one calm, chronological scroll over everything that
 * happened: sessions, outcome measures (with the trend), documents, and care-plan
 * shares. The integrated record no SA point-tool gives you, in one place.
 */
export function ClientTimeline({
  sessions,
  outcomes,
  documents,
  carePlan,
  nowISO,
}: {
  sessions: AppointmentView[];
  outcomes: OutcomeMeasure[];
  documents: ClientDocument[];
  carePlan: CarePlan | null;
  nowISO: string;
}) {
  const nowMs = new Date(nowISO).getTime();
  const events: TimelineEvent[] = [];

  for (const s of sessions) {
    const meta = SESSION_META[s.state] ?? SESSION_META.scheduled!;
    const future = new Date(s.startsAt).getTime() > nowMs;
    events.push({
      at: s.startsAt,
      icon: meta.icon,
      tone: meta.tone,
      title: future && s.state === "scheduled" ? "Upcoming session" : meta.label,
      detail: `${s.serviceName}${s.counsellorName ? ` · ${s.counsellorName}` : ""}`,
    });
  }

  // Outcome measures, with the change vs the previous of the same tool.
  const byTool = new Map<string, OutcomeMeasure[]>();
  for (const o of outcomes) (byTool.get(o.tool) ?? byTool.set(o.tool, []).get(o.tool)!).push(o);
  for (const [, list] of byTool) {
    const sorted = [...list].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    sorted.forEach((o, i) => {
      const prev = i > 0 ? sorted[i - 1]!.score : null;
      const delta = prev === null ? null : o.score - prev;
      // Lower is better for PHQ-9/GAD-7 → a drop is improvement (accent).
      const trend = delta === null ? "" : delta < 0 ? ` (▼${Math.abs(delta)} improved)` : delta > 0 ? ` (▲${delta})` : " (no change)";
      events.push({
        at: o.takenAt,
        icon: delta !== null && delta < 0 ? TrendingDown : delta !== null && delta > 0 ? TrendingUp : Activity,
        tone: delta !== null && delta < 0 ? "accent" : delta !== null && delta > 0 ? "warn" : "info",
        title: `${o.tool} recorded: ${o.score}`,
        detail: `Score${trend}`,
      });
    });
  }

  for (const d of documents) {
    events.push({ at: d.createdAt, icon: FileText, tone: "neutral", title: `Document: ${d.name}`, detail: `Shared by ${d.sharedBy}` });
  }
  if (carePlan?.sharedAt) {
    events.push({ at: carePlan.sharedAt, icon: Sprout, tone: "accent", title: "Care plan shared", detail: carePlan.summary.slice(0, 90) + (carePlan.summary.length > 90 ? "…" : "") });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));

  if (events.length === 0) {
    return <p className="py-6 text-center text-[12.5px] text-text-3">Nothing recorded yet — it builds up as you work together.</p>;
  }

  // Group by month for calm scanning.
  let lastMonth = "";
  return (
    <ol className="relative space-y-1">
      {events.map((e, i) => {
        const mk = monthKey(e.at);
        const showMonth = mk !== lastMonth;
        lastMonth = mk;
        const tone = TONE[e.tone];
        return (
          <li key={i}>
            {showMonth && <div className="mb-1 mt-3 pl-9 text-[11px] font-[640] uppercase tracking-[0.05em] text-text-3 first:mt-0">{mk}</div>}
            <div className="relative flex gap-3">
              {/* rail + dot */}
              <div className="relative flex w-6 shrink-0 justify-center">
                {i !== events.length - 1 && <span className="absolute top-6 h-full w-px bg-border" aria-hidden />}
                <span className={cn("z-10 mt-0.5 flex size-6 items-center justify-center rounded-full ring-4 ring-surface", tone.dot)}>
                  <e.icon className="size-3.5" strokeWidth={2.2} />
                </span>
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-[600] text-text">{e.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-text-3">{dayLabel(e.at)}</span>
                </div>
                {e.detail && <p className="mt-0.5 truncate text-[12px] text-text-2">{e.detail}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
