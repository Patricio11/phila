"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, Clock, Hourglass, MapPin, NotebookPen, Stethoscope, User, UserX, Video, X } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { rescheduleAppointment } from "@/app/app/appointments/actions";
import { markProgress } from "@/app/app/sessions/[id]/actions";
import { cn } from "@/lib/utils";

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
 * Appointment detail  the calm card a counsellor or admin sees when they click
 * a calendar event. Everything about the booking, then the actions: reschedule,
 * mark completed / no-show, or cancel. No notification fires (messaging dormant).
 */
export function AppointmentDetail({
  appt,
  onClose,
  onUpdated,
  conflictFor,
  openSessions = true,
  canManage = true,
  clientBasePath = "/app/clients",
}: {
  appt: AppointmentView | null;
  onClose: () => void;
  onUpdated?: (appt: AppointmentView) => void;
  conflictFor?: (appt: AppointmentView, newStartISO: string) => string | null;
  openSessions?: boolean;
  canManage?: boolean;
  clientBasePath?: string;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [showReschedule, setShowReschedule] = useState(false);
  const [date, setDate] = useState(appt?.startsAt.slice(0, 10) ?? "");
  const [time, setTime] = useState(appt?.startsAt.slice(11, 16) ?? "");
  const [override, setOverride] = useState(false);

  const state = appt ? STATE[appt.state] : null;
  const proposedStart = date && time ? `${date}T${time}:00+02:00` : null;
  const conflict = appt && proposedStart && conflictFor ? conflictFor(appt, proposedStart) : null;

  const mark = (next: AppointmentState) => {
    if (!appt) return;
    start(async () => {
      const res = await markProgress({ appointmentId: appt.id, state: next });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onUpdated?.({ ...appt, state: next });
      toast({ tone: "success", title: `Marked ${STATE[next].label.toLowerCase()}` });
    });
  };

  const doReschedule = () => {
    if (!appt || !proposedStart) return;
    if (conflict && !override) { setOverride(true); return; } // first click warns, second proceeds
    const newStart = proposedStart;
    start(async () => {
      const res = await rescheduleAppointment({ appointmentId: appt.id, newStart });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onUpdated?.({ ...appt, startsAt: newStart, state: "scheduled" });
      setShowReschedule(false);
      setOverride(false);
      toast({ tone: "success", title: "Session moved", description: "No message was sent  that happens once messaging is set up." });
    });
  };

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

          {/* Manage */}
          {canManage && (
            <div className="space-y-3 border-t border-border pt-4">
              {showReschedule ? (
                <div className="space-y-2.5 rounded-control border border-border bg-surface-2/40 p-3">
                  <div className="text-[12px] font-semibold text-text">Move this session</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setOverride(false); }} aria-label="New date" />
                    <Input type="time" value={time} onChange={(e) => { setTime(e.target.value); setOverride(false); }} aria-label="New time" />
                  </div>
                  {conflict && (
                    <div className="flex items-start gap-2 rounded-control border border-warn/30 bg-warn-soft px-2.5 py-2 text-[12px] text-warn">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden /> {conflict}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowReschedule(false); setOverride(false); }} disabled={pending}>Cancel</Button>
                    <Button size="sm" onClick={doReschedule} loading={pending}>{conflict ? (override ? "Move anyway" : "Check & move") : "Move session"}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <ActionChip icon={CalendarDays} label="Reschedule" onClick={() => setShowReschedule(true)} disabled={pending} />
                  <ActionChip icon={Check} label="Completed" tone="accent" active={appt.state === "completed"} onClick={() => mark("completed")} disabled={pending} />
                  <ActionChip icon={UserX} label="No-show" tone="warn" active={appt.state === "no_show"} onClick={() => mark("no_show")} disabled={pending} />
                  <ActionChip icon={Hourglass} label="Postponed" tone="warn" active={appt.state === "postponed"} onClick={() => mark("postponed")} disabled={pending} />
                  <ActionChip icon={X} label="Cancel" tone="danger" active={appt.state === "cancelled"} onClick={() => mark("cancelled")} disabled={pending} />
                </div>
              )}
              <p className="text-[11px] text-text-3">Marking a session never sends a message  the messaging rail is set up later.</p>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function ActionChip({ icon: Icon, label, onClick, disabled, tone, active }: { icon: typeof Check; label: string; onClick: () => void; disabled?: boolean; tone?: "accent" | "warn" | "danger"; active?: boolean }) {
  const toneCls = active
    ? tone === "danger" ? "border-danger/40 bg-danger-soft text-danger" : tone === "warn" ? "border-warn/40 bg-warn-soft text-warn" : "border-accent/40 bg-accent-soft text-accent"
    : "border-border bg-surface text-text-2 hover:bg-surface-hover hover:text-text";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50", toneCls)}>
      <Icon className="size-3.5" strokeWidth={2} aria-hidden /> {label}
    </button>
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
