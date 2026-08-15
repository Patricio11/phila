"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { za } from "@/lib/format";
import { isRemote } from "@/lib/domain/enums";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, ChevronRight, Clock, Copy, Hash, Hourglass, MapPin, MonitorSmartphone, NotebookPen, Pencil, Phone, Receipt, Repeat, Stethoscope, UserX, Video, X } from "lucide-react";
import { appointmentReference } from "@/lib/scheduling/reference";
import { isoWeekday } from "@/lib/domain/helpers";
import { getRescheduleSlots } from "@/app/app/appointments/actions";
import type { AppointmentView } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { rescheduleAppointment, cancelAppointment, getAppointmentJoinLink, updateAppointmentDetails } from "@/app/app/appointments/actions";
import { getAvailableCounsellors } from "@/lib/scheduling/actions";
import { Select } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import type { SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { getAppointmentInvoice, generateAppointmentInvoice } from "@/app/hub/invoicing/actions";
import { markProgress } from "@/app/app/sessions/[id]/actions";
import { cn } from "@/lib/utils";

type EditScope = "this" | "following";

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
  scheduling,
  canEdit = false,
}: {
  appt: AppointmentView | null;
  onClose: () => void;
  onUpdated?: (appt: AppointmentView) => void;
  conflictFor?: (appt: AppointmentView, newStartISO: string) => string | null;
  openSessions?: boolean;
  canManage?: boolean;
  clientBasePath?: string;
  /** Batch 2v - with these, Edit can change service / counsellor / where / room / duration in place. */
  scheduling?: SchedulingOptions;
  /** Batch 3i - Edit is org-only; counsellor surfaces leave this off. */
  canEdit?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReschedule, setShowReschedule] = useState(false);
  const [moveNote, setMoveNote] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  // Batch 2v - the full editor: what the session IS, changed in place.
  const [showEdit, setShowEdit] = useState(false);
  const [eService, setEService] = useState<string>("");
  const [eCounsellor, setECounsellor] = useState<string>("");
  const [eType, setEType] = useState<"in_person" | "online" | "hybrid">("in_person");
  const [eRoom, setERoom] = useState<string | null>(null);
  const [eDuration, setEDuration] = useState<number>(50);
  const [eAvail, setEAvail] = useState<string[] | null>(null);
  const [date, setDate] = useState(appt?.startsAt.slice(0, 10) ?? "");
  const [time, setTime] = useState(appt?.startsAt.slice(11, 16) ?? "");
  const [override, setOverride] = useState(false);
  const [scope, setScope] = useState<EditScope>("this");
  // Batch 3s - the reschedule panel offers REAL slots (like public booking):
  // days the practice opens, times the counsellor actually works for this
  // session type. No more picking a closed Saturday off a little calendar.
  const [slotOpts, setSlotOpts] = useState<{ start: string; label: string }[] | null>(null);
  const [slotsBusy, setSlotsBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [join, setJoin] = useState<{ id: string; url: string } | null>(null);
  // Feedback batch 2 - the session's invoice, inline (billing never slips out of view).
  const [invoice, setInvoice] = useState<{ id: string; forId: string; number: string; amountCents: number; status: string; dueAt: string } | null | "none">(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const joinUrl = appt && join?.id === appt.id ? join.url : null;

  // Fetch the signed join link when viewing an online session (state set only async).
  useEffect(() => {
    if (!appt || !isRemote(appt.type)) return;
    let live = true;
    const id = appt.id;
    getAppointmentJoinLink({ appointmentId: id }).then((res) => { if (live && res.ok) setJoin({ id, url: res.url }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id, appt?.type]);

  // Fetch the linked invoice whenever a booking is opened.
  useEffect(() => {
    if (!appt) return;
    let live = true;
    const id = appt.id;
    setInvoice(null);
    getAppointmentInvoice({ appointmentId: id }).then((res) => {
      if (live && res.ok) setInvoice(res.invoice ? { ...res.invoice, forId: id } : "none");
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id]);

  const generateInvoice = () => {
    if (!appt) return;
    setGenerating(true);
    void (async () => {
      const res = await generateAppointmentInvoice({ appointmentId: appt.id });
      setGenerating(false);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const refreshed = await getAppointmentInvoice({ appointmentId: appt.id });
      if (refreshed.ok && refreshed.invoice) setInvoice({ ...refreshed.invoice, forId: appt.id });
      toast({ tone: "success", title: `Invoice ${res.number} raised`, description: "It's on the invoicing board - unpaid until reconciled." });
    })();
  };

  const copyJoin = async () => {
    if (!joinUrl) return;
    try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  const openEditor = () => {
    if (!appt) return;
    setEService(appt.serviceId);
    setECounsellor(appt.counsellorId);
    setEType(appt.type as "in_person" | "online" | "hybrid");
    setERoom(appt.roomId ?? null);
    setEDuration(appt.durationMin);
    setShowEdit(true);
  };

  // Who is free for THIS slot, asked the way it will happen (type-aware, 2n).
  useEffect(() => {
    if (!showEdit || !appt || !scheduling) return;
    let live = true;
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(appt.startsAt));
    const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(appt.startsAt));
    getAvailableCounsellors({ orgId: scheduling.orgId, date: d, time: t, durationMin: eDuration, clientId: appt.clientId, type: eType })
      .then((res) => { if (live && res.ok) setEAvail(res.available); })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEdit, appt?.id, eType, eDuration]);

  const doEdit = () => {
    if (!appt) return;
    const useScope: EditScope = isSeries ? scope : "this";
    start(async () => {
      const res = await updateAppointmentDetails({
        appointmentId: appt.id,
        serviceId: eService !== appt.serviceId ? eService : undefined,
        counsellorId: eCounsellor !== appt.counsellorId ? eCounsellor : undefined,
        type: eType !== appt.type ? eType : undefined,
        roomId: eType === "online" ? null : eRoom,
        durationMin: eDuration !== appt.durationMin ? eDuration : undefined,
        scope: useScope,
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const svc = scheduling?.services.find((x) => x.id === eService);
      const couns = scheduling?.counsellors.find((x) => x.id === eCounsellor);
      const room = scheduling?.rooms.find((x) => x.id === eRoom);
      onUpdated?.({
        ...appt,
        serviceId: eService, serviceName: svc?.name ?? appt.serviceName,
        counsellorId: eCounsellor, counsellorName: couns?.name ?? appt.counsellorName,
        type: eType, roomId: eType === "online" ? null : eRoom, roomName: eType === "online" ? null : (room?.name ?? appt.roomName),
        durationMin: eDuration,
      });
      if (useScope === "following") router.refresh();
      setShowEdit(false);
      setScope("this");
      toast({ tone: "success", title: res.updated > 1 ? `${res.updated} sessions updated` : "Session updated" });
    });
  };

  const isSeries = Boolean(appt?.seriesId);
  const state = appt ? STATE[appt.state] : null;
  const proposedStart = date && time ? `${date}T${time}:00+02:00` : null;
  const conflict = appt && proposedStart && conflictFor ? conflictFor(appt, proposedStart) : null;

  const hours = scheduling?.businessHours ?? null;
  // The next open practice days (skips closed weekdays entirely).
  const openDays = useMemo(() => {
    if (!hours) return [];
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const out: string[] = [];
    for (let i = 0; i < 45 && out.length < 14; i++) {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      if (hours[isoWeekday(iso)]) out.push(iso);
    }
    return out;
  }, [hours]);

  useEffect(() => {
    if (!showReschedule || !appt || !hours || !date) return;
    let live = true;
    setSlotsBusy(true);
    getRescheduleSlots({ appointmentId: appt.id, date }).then((res) => {
      if (!live) return;
      setSlotsBusy(false);
      setSlotOpts(res.ok ? res.slots : []);
    }).catch(() => { if (live) { setSlotsBusy(false); setSlotOpts([]); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReschedule, appt?.id, date, Boolean(hours)]);

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
    const useScope: EditScope = isSeries ? scope : "this";
    start(async () => {
      const res = await rescheduleAppointment({ appointmentId: appt.id, newStart, scope: useScope, note: moveNote.trim() || undefined });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onUpdated?.({ ...appt, startsAt: newStart, state: "scheduled", rescheduleNote: moveNote.trim() || appt.rescheduleNote });
      if (useScope === "following") router.refresh();
      setShowReschedule(false);
      setOverride(false);
      setScope("this");
      setMoveNote("");
      toast({ tone: "success", title: res.moved > 1 ? `${res.moved} sessions moved` : "Session moved", description: "The client is notified by email + in-app." });
    });
  };

  const doCancel = () => {
    if (!appt) return;
    const useScope: EditScope = isSeries ? scope : "this";
    start(async () => {
      const res = await cancelAppointment({ appointmentId: appt.id, reason, scope: useScope });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onUpdated?.({ ...appt, state: "cancelled" });
      if (useScope === "following") router.refresh();
      setShowCancel(false);
      setScope("this");
      setReason("");
      toast({ tone: "success", title: res.cancelled > 1 ? `${res.cancelled} sessions cancelled` : "Session cancelled" });
    });
  };

  return (
    <Dialog
      open={Boolean(appt)}
      onClose={onClose}
      title={appt ? appt.serviceName : "Appointment"}
      footer={
        appt && canManage && !showEdit && !showReschedule && !showCancel ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {scheduling && canEdit && appt.state !== "cancelled" && (
                <ActionChip icon={Pencil} label="Edit" onClick={openEditor} disabled={pending} />
              )}
              <ActionChip icon={CalendarDays} label="Reschedule" onClick={() => setShowReschedule(true)} disabled={pending} />
              <ActionChip icon={Check} label="Completed" tone="accent" active={appt.state === "completed"} onClick={() => mark("completed")} disabled={pending} />
              <ActionChip icon={UserX} label="No-show" tone="warn" active={appt.state === "no_show"} onClick={() => mark("no_show")} disabled={pending} />
              <ActionChip icon={Hourglass} label="Postponed" tone="warn" active={appt.state === "postponed"} onClick={() => mark("postponed")} disabled={pending} />
              <ActionChip icon={X} label="Cancel" tone="danger" active={appt.state === "cancelled"} onClick={() => setShowCancel(true)} disabled={pending} />
              {openSessions && (
                <Link
                  href={`/app/sessions/${appt.id}`}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-ink transition-colors hover:opacity-90"
                >
                  <NotebookPen className="size-3.5" strokeWidth={2} aria-hidden /> Open session
                </Link>
              )}
            </div>
            <p className="text-[11px] text-text-3">Marking a session never sends a message  the messaging rail is set up later.</p>
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
              <Link href={`${clientBasePath}/${appt.clientId}`} className="group inline-flex items-center gap-1 text-[16px] font-[660] text-text hover:text-accent">
                {appt.clientName}
                <ChevronRight className="size-4 text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" strokeWidth={2} aria-hidden />
              </Link>
              <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-2">
                <span className="inline-flex items-center gap-1.5"><StatusDot tone={state.tone} /> {state.label}</span>
                {isSeries && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-1.5 py-0.5 text-[10.5px] font-medium text-text-3">
                    <Repeat className="size-3" strokeWidth={2} aria-hidden /> Weekly series
                  </span>
                )}
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
              icon={isRemote(appt.type) ? Video : MapPin}
              label={appt.type === "online" ? "Online" : appt.type === "hybrid" ? "Hybrid" : "Location"}
              value={appt.type === "online" ? "Secure video room" : appt.type === "hybrid" ? `${appt.roomName ?? "Practice room"} · client joins online` : (appt.roomName ?? "In person")}
            />
            {/* Batch 3l - the booking reference: on every message about this
                session, printed on its invoice, and searchable from ⌘K. */}
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-3">
                <Hash className="size-3.5" strokeWidth={2} aria-hidden /> Reference
              </dt>
              <dd className="mt-0.5">
                <button
                  type="button"
                  title="Copy reference"
                  onClick={() => {
                    void navigator.clipboard?.writeText(appointmentReference(appt.id));
                    toast({ tone: "success", title: "Reference copied", description: appointmentReference(appt.id) });
                  }}
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold tracking-wide text-text transition-colors hover:text-accent"
                >
                  {appointmentReference(appt.id)}
                  <Copy className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />
                </button>
              </dd>
            </div>
            {appt.rescheduleNote && <Row icon={NotebookPen} label="Rescheduled  reason" value={appt.rescheduleNote} wide />}
            {appt.heldByPhone && (
              <Row
                icon={Phone}
                label="Held by phone"
                value={`${appt.callDurationMin ? `${appt.callDurationMin} min call` : "Phone call"}${appt.phoneNote ? ` · ${appt.phoneNote}` : ""}`}
                wide
              />
            )}
          </dl>

          {/* Billing - the invoice lives with the session (feedback batch 2) */}
          {invoice !== null && (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface-2/40 px-3.5 py-2.5">
              <Receipt className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
              {invoice !== "none" && invoice.forId === appt.id ? (
                <>
                  <span className="text-[12.5px] font-medium tabular-nums text-text">{invoice.number}</span>
                  <span className="text-[12.5px] tabular-nums text-text-2">R{za((invoice.amountCents / 100))}</span>
                  <span className={cn(
                    "rounded-chip px-2 py-0.5 text-[11px] font-semibold",
                    invoice.status === "paid" ? "bg-accent-soft text-accent" : invoice.status === "cancelled" ? "bg-surface-2 text-text-3" : "bg-warn-soft text-warn",
                  )}>
                    {invoice.status === "paid" ? "Paid" : invoice.status === "cancelled" ? "Cancelled" : "Unpaid"}
                  </span>
                  <Link href="/hub/invoicing" className="ml-auto text-[12px] font-medium text-accent hover:underline">Open invoicing</Link>
                </>
              ) : (
                <>
                  <span className="text-[12.5px] text-text-2">No invoice for this session yet.</span>
                  {canManage && appt.state !== "cancelled" && (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={generateInvoice} loading={generating}>Generate invoice</Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Online join link  the counsellor joins, or copies the invite for the client */}
          {isRemote(appt.type) && appt.state !== "cancelled" && (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-accent/25 bg-accent-soft/20 p-3">
              <Video className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1 text-[12.5px] text-text-2">{joinUrl ? "Secure Phila video room  ready to join" : "Preparing the room link…"}</span>
              <Button variant="ghost" size="sm" onClick={copyJoin} disabled={!joinUrl}>
                {copied ? <Check className="size-3.5 text-accent" strokeWidth={2.4} aria-hidden /> : <Copy className="size-3.5" strokeWidth={2} aria-hidden />} {copied ? "Copied" : "Copy link"}
              </Button>
              <Button asChild size="sm" className={cn(!joinUrl && "pointer-events-none opacity-60")}>
                <a href={joinUrl ?? "#"} target="_blank" rel="noopener noreferrer"><Video className="size-3.5" strokeWidth={2} aria-hidden /> Join now</a>
              </Button>
            </div>
          )}

          {/* Manage */}
          {canManage && (showEdit || showReschedule || showCancel) && (
            <div className="space-y-3 border-t border-border pt-4">
              {showEdit && scheduling ? (
                <div className="space-y-2.5 rounded-control border border-border bg-surface-2/40 p-3">
                  <div className="text-[12px] font-semibold text-text">Edit {isSeries && scope === "following" ? "these sessions" : "this session"}</div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-text-3">Service</span>
                      <Select ariaLabel="Service" value={eService} onChange={(v) => { setEService(v); const svc = scheduling.services.find((x) => x.id === v); if (svc) setEDuration(svc.durationMin); }} options={scheduling.services.map((x) => ({ value: x.id, label: x.name }))} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-text-3">Duration</span>
                      <Select ariaLabel="Duration" value={String(eDuration)} onChange={(v) => setEDuration(Number(v))} options={Array.from(new Set([30, 45, 50, 60, 90, eDuration])).sort((a, b) => a - b).map((n) => ({ value: String(n), label: `${n} minutes` }))} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-text-3">Where</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { key: "in_person" as const, label: "In person", icon: MapPin },
                        { key: "online" as const, label: "Online", icon: Video },
                        { key: "hybrid" as const, label: "Hybrid", icon: MonitorSmartphone },
                      ]).map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setEType(key); if (key === "online") setERoom(null); }}
                          aria-pressed={eType === key}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-control border px-2 py-2 text-[12px] font-medium transition-colors",
                            eType === key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
                          )}
                        >
                          <Icon className="size-3.5" strokeWidth={2} aria-hidden /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-text-3">Counsellor</span>
                      <SearchSelect
                        avatars
                        ariaLabel="Counsellor"
                        value={eCounsellor}
                        onChange={setECounsellor}
                        placeholder="Choose a counsellor"
                        searchPlaceholder="Search counsellors…"
                        options={scheduling.counsellors
                          .filter((x) => !eAvail || eAvail.includes(x.id) || x.id === eCounsellor)
                          .map((x) => ({ value: x.id, label: x.name }))}
                      />
                      {eAvail && !eAvail.includes(eCounsellor) && (
                        <p className="text-[11px] text-warn">Not available {eType === "online" ? "online" : eType === "hybrid" ? "for hybrid" : "in person"} at this time.</p>
                      )}
                    </div>
                    {eType !== "online" && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-text-3">Room</span>
                        <Select ariaLabel="Room" value={eRoom ?? ""} onChange={(v) => setERoom(v || null)} options={[{ value: "", label: "Choose a room…" }, ...scheduling.rooms.map((x) => ({ value: x.id, label: x.name }))]} />
                      </div>
                    )}
                  </div>

                  {isSeries && <ScopeToggle scope={scope} onChange={setScope} kind="edit" />}

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowEdit(false); setScope("this"); }} disabled={pending}>
                      <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> Back
                    </Button>
                    <Button size="sm" onClick={doEdit} loading={pending} disabled={eType !== "online" && !eRoom}>
                      Save {isSeries && scope === "following" ? "all following" : "changes"}
                    </Button>
                  </div>
                </div>
              ) : showReschedule ? (
                <div className="space-y-2.5 rounded-control border border-border bg-surface-2/40 p-3">
                  <div className="text-[12px] font-semibold text-text">Move {isSeries && scope === "following" ? "these sessions" : "this session"}</div>
                  {hours ? (
                    <>
                      {/* Open practice days only - a closed Saturday simply isn't here. */}
                      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                        {openDays.map((d: string) => {
                          const dd = new Date(`${d}T12:00:00Z`);
                          const selected = date === d;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => { setDate(d); setTime(""); setOverride(false); }}
                              aria-pressed={selected}
                              className={cn(
                                "flex min-w-[52px] shrink-0 flex-col items-center rounded-control border px-2 py-1.5 transition-colors",
                                selected ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
                              )}
                            >
                              <span className="text-[10px] font-medium uppercase tracking-wide">{new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", weekday: "short" }).format(dd)}</span>
                              <span className="text-[15px] font-bold tabular-nums leading-tight">{new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric" }).format(dd)}</span>
                              <span className="text-[9.5px] text-text-3">{new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "short" }).format(dd)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {/* The times this counsellor really has for this kind of session. */}
                      {slotsBusy ? (
                        <p className="py-3 text-center text-[12px] text-text-3">Finding open times…</p>
                      ) : (slotOpts ?? []).length === 0 ? (
                        <p className="py-3 text-center text-[12px] text-text-3">No open times this day - try another.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-1.5">
                          {(slotOpts ?? []).map((sl) => (
                            <button
                              key={sl.start}
                              type="button"
                              onClick={() => { setTime(sl.label); setOverride(false); }}
                              aria-pressed={time === sl.label}
                              className={cn(
                                "h-8 rounded-control border text-[12.5px] font-medium tabular-nums transition-colors",
                                time === sl.label ? "border-accent bg-accent text-accent-ink" : "border-border bg-surface text-text hover:border-accent/50 hover:bg-accent-soft/40",
                              )}
                            >
                              {sl.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker value={date} onChange={(v) => { setDate(v); setOverride(false); }} ariaLabel="New date" />
                      <TimePicker value={time} onChange={(v) => { setTime(v); setOverride(false); }} ariaLabel="New time" />
                    </div>
                  )}
                  {isSeries && <ScopeToggle scope={scope} onChange={setScope} kind="move" />}
                  <Textarea value={moveNote} onChange={(e) => setMoveNote(e.target.value)} rows={2} placeholder="Reason (optional)  kept on the record" aria-label="Reschedule reason" />
                  {conflict && (
                    <div className="flex items-start gap-2 rounded-control border border-warn/30 bg-warn-soft px-2.5 py-2 text-[12px] text-warn">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden /> {conflict}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowReschedule(false); setOverride(false); setScope("this"); setMoveNote(""); }} disabled={pending}>
                      <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> Back
                    </Button>
                    <Button size="sm" onClick={doReschedule} loading={pending} disabled={!proposedStart}>{conflict ? (override ? "Move anyway" : "Check & move") : "Move session"}</Button>
                  </div>
                </div>
              ) : showCancel ? (
                <div className="space-y-2.5 rounded-control border border-danger/30 bg-danger-soft/40 p-3">
                  <div className="text-[12px] font-semibold text-text">Cancel {isSeries && scope === "following" ? "these sessions" : "this session"}</div>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (optional)  kept on the record" aria-label="Cancellation reason" />
                  {isSeries && <ScopeToggle scope={scope} onChange={setScope} kind="cancel" />}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowCancel(false); setScope("this"); setReason(""); }} disabled={pending}>
                      <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> Back
                    </Button>
                    <Button variant="danger" size="sm" onClick={doCancel} loading={pending}>Cancel {isSeries && scope === "following" ? "all following" : "session"}</Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** This-session vs whole-series picker, shown only for recurring appointments. */
function ScopeToggle({ scope, onChange, kind }: { scope: EditScope; onChange: (s: EditScope) => void; kind: "move" | "cancel" | "edit" }) {
  const verb = kind === "move" ? "Move" : kind === "edit" ? "Update" : "Cancel";
  const opts: { value: EditScope; label: string }[] = [
    { value: "this", label: "This session only" },
    { value: "following", label: `${verb} this and all following` },
  ];
  // Real radios, visibly so - the earlier pill segments read as more buttons
  // sitting right next to the actual buttons.
  return (
    <div className="space-y-1" role="radiogroup" aria-label="Apply to">
      {opts.map((o) => {
        const on = scope === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="flex w-full items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors hover:bg-surface-hover"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                on ? "border-accent" : "border-border-strong",
              )}
            >
              <span className={cn("size-2 rounded-full bg-accent transition-transform", on ? "scale-100" : "scale-0")} />
            </span>
            <span className={cn("text-[12.5px]", on ? "font-medium text-text" : "text-text-2")}>{o.label}</span>
          </button>
        );
      })}
    </div>
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
