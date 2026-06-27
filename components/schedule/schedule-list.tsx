import type { AppointmentView } from "@/lib/data-provider";
import { AppointmentRow } from "@/components/schedule/appointment-row";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarCheck } from "lucide-react";

/**
 * Today's schedule with the **"now" line** — an amber label + a fading rule that
 * marks the current time between the last finished and the next upcoming session
 * (DESIGN.md §6). A row whose window contains "now" reads as in session.
 */
export function ScheduleList({
  appointments,
  nowISO,
}: {
  appointments: AppointmentView[];
  nowISO: string;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No sessions today"
        body="Your day is clear. New bookings will appear here as they come in."
      />
    );
  }

  const nowMs = new Date(nowISO).getTime();
  // The index of the first session that starts after now.
  const nextIndex = appointments.findIndex((a) => new Date(a.startsAt).getTime() > nowMs);
  const nowLineAt = nextIndex === -1 ? appointments.length : nextIndex;
  const showNowLine =
    nowLineAt > 0 && nowLineAt <= appointments.length && nextIndex !== 0;

  const nowLabel = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(nowISO));

  return (
    <div className="space-y-0.5">
      {appointments.map((appt, i) => {
        const start = new Date(appt.startsAt).getTime();
        const end = start + appt.durationMin * 60_000;
        const phase =
          nowMs >= start && nowMs < end && appt.state !== "completed"
            ? "in_session"
            : start <= nowMs
              ? "past"
              : "upcoming";

        return (
          <div key={appt.id}>
            {showNowLine && i === nowLineAt ? <NowLine label={nowLabel} /> : null}
            <AppointmentRow appt={appt} phase={phase} />
          </div>
        );
      })}
    </div>
  );
}

function NowLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5" aria-hidden>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-warn">
        Now · {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-warn/50 to-transparent" />
    </div>
  );
}
