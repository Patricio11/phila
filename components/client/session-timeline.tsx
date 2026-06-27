import { Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { Tag } from "@/components/ui/tag";

const STATE: Record<AppointmentState, { tone: DotTone; word: string }> = {
  scheduled: { tone: "grey", word: "Upcoming" },
  completed: { tone: "green", word: "Completed" },
  no_show: { tone: "amber", word: "Missed" },
  cancelled: { tone: "grey", word: "Cancelled" },
  rescheduled: { tone: "grey", word: "Rescheduled" },
  postponed: { tone: "amber", word: "Postponed" },
  discharged: { tone: "green", word: "Completed" },
  risk_flagged: { tone: "grey", word: "Upcoming" },
};

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

export function SessionTimeline({
  appointments,
  nowISO,
  limit,
}: {
  appointments: AppointmentView[];
  nowISO: string;
  limit?: number;
}) {
  const nowMs = new Date(nowISO).getTime();
  const sorted = [...appointments].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  const shown = limit ? sorted.slice(0, limit) : sorted;

  return (
    <ol className="relative space-y-1">
      {shown.map((appt) => {
        const isUpcoming = new Date(appt.startsAt).getTime() > nowMs && appt.state === "scheduled";
        const display = isUpcoming ? { tone: "blue" as DotTone, word: "Upcoming" } : STATE[appt.state];
        return (
          <li
            key={appt.id}
            className="flex items-center gap-3 rounded-control border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
          >
            <Avatar name={appt.counsellorName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13.5px] font-medium text-text">{appt.serviceName}</span>
                {appt.type === "online" ? (
                  <Tag tone="online">
                    <Video className="size-3" strokeWidth={2} aria-hidden /> Online
                  </Tag>
                ) : appt.roomName ? (
                  <Tag tone="neutral">{appt.roomName}</Tag>
                ) : null}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-3">
                {whenLabel(appt.startsAt)} · with {appt.counsellorName.split(" ")[0]}
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
              <StatusDot tone={display.tone} /> {display.word}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
