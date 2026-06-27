import { Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";
import { cn, initials } from "@/lib/utils";

type Phase = "past" | "in_session" | "upcoming";

const STATE_DISPLAY: Record<AppointmentState, { tone: DotTone; word: string }> = {
  scheduled: { tone: "grey", word: "Upcoming" },
  completed: { tone: "green", word: "Completed" },
  no_show: { tone: "amber", word: "No-show" },
  cancelled: { tone: "grey", word: "Cancelled" },
  rescheduled: { tone: "grey", word: "Rescheduled" },
  postponed: { tone: "amber", word: "Postponed" },
  discharged: { tone: "green", word: "Discharged" },
  risk_flagged: { tone: "rose", word: "Safeguarding" },
};

/**
 * AppointmentRow (DESIGN.md §6): time (+ duration / "done") · coloured initials
 * avatar · name · meta (status dot + state word + tags) · a right-aligned action.
 * The in-session row is tinted `--accent-soft`. Status is always dot + word,
 * never colour alone.
 */
export function AppointmentRow({ appt, phase }: { appt: AppointmentView; phase: Phase }) {
  const time = appt.startsAt.slice(11, 16);
  const inSession = phase === "in_session";
  const display = inSession
    ? { tone: "blue" as DotTone, word: "In session" }
    : STATE_DISPLAY[appt.state];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-control px-2.5 py-2.5 transition-colors",
        inSession ? "bg-accent-soft" : "hover:bg-surface-hover",
        phase === "past" && appt.state !== "risk_flagged" && "opacity-75",
      )}
    >
      {/* Time */}
      <div className="w-14 shrink-0 text-right">
        <div className="text-[13.5px] font-semibold tabular-nums text-text">{time}</div>
        <div className="text-[11px] text-text-3">
          {appt.state === "completed" ? "Done" : `${appt.durationMin} min`}
        </div>
      </div>

      <Avatar name={appt.clientName} size="md" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-text">{appt.clientName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
            <StatusDot tone={display.tone} pulse={inSession} />
            {display.word}
          </span>
          <span className="text-text-3">·</span>
          <span className="truncate text-[12px] text-text-3">{appt.serviceName}</span>
          {appt.type === "online" ? (
            <Tag tone="online">
              <Video className="size-3" strokeWidth={2} aria-hidden /> Online
            </Tag>
          ) : appt.roomName ? (
            <Tag tone="neutral">{appt.roomName}</Tag>
          ) : null}
          {appt.tags?.map((t) => (
            <Tag key={t} tone={t === "Safeguarding" ? "danger" : "neutral"}>
              {t}
            </Tag>
          ))}
        </div>
      </div>

      <RowAction appt={appt} phase={phase} />
    </div>
  );
}

function RowAction({ appt, phase }: { appt: AppointmentView; phase: Phase }) {
  const label =
    appt.state === "completed"
      ? "Note ✓"
      : phase === "in_session" || appt.state === "risk_flagged"
        ? "Open session"
        : "Prepare";

  const solid = phase === "in_session" || appt.state === "risk_flagged";

  return (
    <button
      type="button"
      aria-label={`${label} — ${appt.clientName}`}
      className={cn(
        "hidden h-8 shrink-0 items-center rounded-chip px-2.5 text-[12.5px] font-medium transition-colors sm:inline-flex",
        solid
          ? "bg-accent text-accent-ink hover:bg-accent-hover"
          : "border border-border bg-surface text-text-2 hover:bg-surface-hover hover:text-text",
      )}
      title={`${appt.clientName} · ${initials(appt.clientName)}`}
    >
      {label}
    </button>
  );
}
