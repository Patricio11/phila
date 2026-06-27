"use client";

import Link from "next/link";
import { CalendarDays, Clock, Hourglass, MapPin, NotebookPen, Stethoscope, User, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";

const STATE: Record<AppointmentState, { label: string; tone: DotTone }> = {
  scheduled: { label: "Scheduled", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  no_show: { label: "No-show", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "grey" },
  rescheduled: { label: "Rescheduled", tone: "grey" },
  postponed: { label: "Postponed", tone: "amber" },
  discharged: { label: "Discharged", tone: "green" },
  risk_flagged: { label: "Safeguarding", tone: "rose" },
};

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}
function timeRange(iso: string, durationMin: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMin * 60000);
  const f = (d: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${f(start)} – ${f(end)}`;
}

/**
 * Appointment detail — the calm card a counsellor or admin sees when they click
 * a calendar event. Everything about the booking at a glance, then the actions.
 */
export function AppointmentDetail({
  appt,
  onClose,
  openSessions = true,
  clientBasePath = "/app/clients",
}: {
  appt: AppointmentView | null;
  onClose: () => void;
  openSessions?: boolean;
  clientBasePath?: string;
}) {
  const state = appt ? STATE[appt.state] : null;
  return (
    <Dialog
      open={Boolean(appt)}
      onClose={onClose}
      title={appt ? appt.serviceName : "Appointment"}
      footer={
        appt ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="ghost">
              <Link href={`${clientBasePath}/${appt.clientId}`}>
                <User className="size-4" strokeWidth={2} aria-hidden /> View client
              </Link>
            </Button>
            {openSessions && (
              <Button asChild>
                <Link href={`/app/sessions/${appt.id}`}>
                  <NotebookPen className="size-4" strokeWidth={2} aria-hidden /> Open session
                </Link>
              </Button>
            )}
          </div>
        ) : null
      }
    >
      {appt && state && (
        <div className="space-y-4">
          {/* Client + status */}
          <div className="flex items-center gap-3">
            <Avatar name={appt.clientName} size="md" />
            <div className="min-w-0 flex-1">
              <Link href={`${clientBasePath}/${appt.clientId}`} className="text-[16px] font-[660] text-text hover:text-accent hover:underline">
                {appt.clientName}
              </Link>
              <div className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-text-2">
                <StatusDot tone={state.tone} /> {state.label}
              </div>
            </div>
          </div>

          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-border bg-surface-2/40 p-3.5">
            <Row icon={CalendarDays} label="Date" value={longDate(appt.startsAt)} wide />
            <Row icon={Clock} label="Time" value={timeRange(appt.startsAt, appt.durationMin)} />
            <Row icon={Hourglass} label="Duration" value={`${appt.durationMin} min`} />
            <Row icon={Stethoscope} label="Counsellor" value={appt.counsellorName} />
            <Row
              icon={appt.type === "online" ? Video : MapPin}
              label={appt.type === "online" ? "Online" : "Location"}
              value={appt.type === "online" ? "Secure video room" : (appt.roomName ?? "In person")}
            />
          </dl>
        </div>
      )}
    </Dialog>
  );
}

function Row({ icon: Icon, label, value, wide }: { icon: typeof Clock; label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-3">
        <Icon className="size-3.5" strokeWidth={2} aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-text">{value}</dd>
    </div>
  );
}
