import Link from "next/link";
import { ChevronRight, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

/** Node + pill appearance per lifecycle state. `dot`/`ring` are Tailwind colour classes. */
interface NodeStyle { word: string; dot: string; ring: string; pill: string; hollow?: boolean }
const STATE: Record<AppointmentState, NodeStyle> = {
  completed: { word: "Completed", dot: "bg-accent", ring: "ring-accent/20", pill: "text-accent bg-accent-soft" },
  discharged: { word: "Discharged", dot: "bg-accent", ring: "ring-accent/20", pill: "text-accent bg-accent-soft" },
  risk_flagged: { word: "Flagged", dot: "bg-danger", ring: "ring-danger/20", pill: "text-danger bg-danger-soft" },
  no_show: { word: "Missed", dot: "bg-warn", ring: "ring-warn/20", pill: "text-warn bg-warn-soft" },
  postponed: { word: "Postponed", dot: "bg-warn", ring: "ring-warn/20", pill: "text-warn bg-warn-soft" },
  cancelled: { word: "Cancelled", dot: "bg-text-3", ring: "ring-border", pill: "text-text-3 bg-surface-2", hollow: true },
  rescheduled: { word: "Rescheduled", dot: "bg-text-3", ring: "ring-border", pill: "text-text-3 bg-surface-2", hollow: true },
  scheduled: { word: "Upcoming", dot: "bg-text-3", ring: "ring-border", pill: "text-text-3 bg-surface-2" },
};
const UPCOMING: NodeStyle = { word: "Upcoming", dot: "bg-[color:var(--color-info,#5B84D6)]", ring: "ring-[color:var(--color-info,#5B84D6)]/25", pill: "text-[color:var(--color-info,#5B84D6)] bg-[color:var(--color-info,#5B84D6)]/10" };

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}
function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function monthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "long", year: "numeric" }).format(new Date(iso));
}
const HELD: AppointmentState[] = ["completed", "discharged", "risk_flagged"];

/**
 * The client's session journey as a vertical timeline: a continuous rail with a
 * coloured node per session, grouped by month, newest first. Shared, read-only, and
 * identical for the client (/me), the counsellor, and the hub  a beautiful, honest
 * record of the relationship. `hrefFor` turns a row into a link (e.g. the Hub → note).
 */
export function SessionTimeline({
  appointments,
  nowISO,
  limit,
  hrefFor,
  renderAction,
}: {
  appointments: AppointmentView[];
  nowISO: string;
  limit?: number;
  hrefFor?: (appt: AppointmentView) => string | null;
  /** Optional per-row action rendered under the card (e.g. the client's request-change control). */
  renderAction?: (appt: AppointmentView) => React.ReactNode;
}) {
  const nowMs = new Date(nowISO).getTime();

  // Chronological "Session N" numbers over held sessions (only meaningful for the
  // full history, so we skip numbering when the caller limits the list).
  const heldOrder = [...appointments]
    .filter((a) => HELD.includes(a.state))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((a) => a.id);
  const sessionNo = (id: string) => (limit ? null : heldOrder.indexOf(id) + 1 || null);

  const sorted = [...appointments].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const shown = limit ? sorted.slice(0, limit) : sorted;

  return (
    <ol className="relative">
      {shown.map((appt, i) => {
        const isUpcoming = new Date(appt.startsAt).getTime() > nowMs && appt.state === "scheduled";
        const s = isUpcoming ? UPCOMING : STATE[appt.state];
        const href = hrefFor?.(appt) ?? null;
        const isLast = i === shown.length - 1;
        const month = monthLabel(appt.startsAt);
        const showMonth = i === 0 || monthLabel(shown[i - 1]!.startsAt) !== month;
        const no = sessionNo(appt.id);

        const inner = (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {no != null && <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Session {no}</span>}
                <span className="text-[13.5px] font-[620] text-text">{appt.serviceName}</span>
                {appt.type === "online" ? (
                  <Tag tone="online"><Video className="size-3" strokeWidth={2} aria-hidden /> Online</Tag>
                ) : appt.roomName ? (
                  <Tag tone="neutral">{appt.roomName}</Tag>
                ) : null}
              </div>
              <div className="mt-0.5 text-[12px] text-text-3">
                {dayLabel(appt.startsAt)} · {timeLabel(appt.startsAt)} · with {appt.counsellorName.split(" ")[0]}
              </div>
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", s.pill)}>{s.word}</span>
            {href && <ChevronRight className="size-4 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />}
          </>
        );
        const cardCls = cn(
          "group flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-2.5 transition-all",
          href ? "hover:-translate-y-px hover:border-border-strong hover:shadow-sm" : "",
        );

        return (
          <li key={appt.id}>
            {showMonth && (
              <div className="flex items-center gap-3 pb-1.5 pt-1 first:pt-0">
                <div className="flex w-7 justify-center">
                  <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-border-strong" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">{month}</span>
              </div>
            )}
            <div className="flex gap-3">
              {/* Rail: node + connector to the next row. */}
              <div className="flex w-7 flex-col items-center">
                <span className="relative mt-3 flex size-3.5 items-center justify-center">
                  {isUpcoming && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", s.dot)} />}
                  <span className={cn("relative inline-flex size-3.5 rounded-full ring-4", s.ring, s.hollow ? "border-2 border-text-3 bg-surface" : s.dot)}>
                    {appt.type === "online" && !s.hollow && <Video className="m-auto size-2 text-surface" strokeWidth={2.5} aria-hidden />}
                  </span>
                </span>
                {!isLast && <span className="w-px flex-1 bg-border" />}
              </div>
              {/* Card */}
              <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-3")}>
                {href ? <Link href={href} className={cardCls}>{inner}</Link> : <div className={cardCls}>{inner}</div>}
                {renderAction && isUpcoming && (() => {
                  const action = renderAction(appt);
                  return action ? <div className="mt-2">{action}</div> : null;
                })()}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
