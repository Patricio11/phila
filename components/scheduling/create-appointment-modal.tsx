"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, Check, MapPin, Plus, UserPlus, Video, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createAppointment, createClientForBooking } from "@/lib/scheduling/actions";
import { isoWeekday } from "@/lib/domain/helpers";
import type { BusinessHours } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface SchedulingOptions {
  orgId: string;
  clients: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number }[];
  counsellors: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  defaultCounsellorId?: string;
  /** When present, the booking is validated against the practice's working hours. */
  businessHours?: BusinessHours;
}

function hm(t: string): number { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }

const DURATIONS = [30, 45, 60, 90];

export interface CreateInitial {
  date?: string;
  time?: string;
  counsellorId?: string;
  roomId?: string;
  type?: "In person" | "Online";
}

export function CreateAppointmentModal({
  open,
  onClose,
  options,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  options: SchedulingOptions;
  initial?: CreateInitial;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [creating, startCreate] = useTransition();
  const [attempted, setAttempted] = useState(false);

  // Local client list so a newly-created client appears + can be selected immediately.
  const [clients, setClients] = useState(options.clients);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [nc, setNc] = useState({ name: "", phone: "", email: "" });
  const [ncError, setNcError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [counsellorId, setCounsellorId] = useState<string | null>(initial?.counsellorId ?? options.defaultCounsellorId ?? null);
  const [type, setType] = useState(initial?.type ?? "In person");
  const [roomId, setRoomId] = useState<string | null>(initial?.roomId ?? null);
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [durationMin, setDurationMin] = useState(60);
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState<number | null>(8);
  const [notes, setNotes] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(true);

  const isOnline = type === "Online";

  const onService = (id: string) => {
    setServiceId(id);
    const svc = options.services.find((s) => s.id === id);
    if (svc) setDurationMin(svc.durationMin);
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!clientId) e.client = "Pick a client.";
    if (!serviceId) e.service = "Pick a service.";
    if (!counsellorId) e.counsellor = "Pick a counsellor.";
    if (!date) e.date = "Pick a date.";
    if (!time) e.time = "Pick a time.";
    if (!isOnline && !roomId) e.room = "Pick a room.";

    // Working-hours guard  an in-person or online booking can't fall on a
    // closed day or outside the practice's hours (Phase 11 enforces server-side).
    const bh = options.businessHours;
    if (bh && date) {
      const day = bh[isoWeekday(date) as keyof BusinessHours];
      if (!day) {
        e.date = "The practice is closed that day  pick a working day.";
      } else if (time) {
        const t = hm(time);
        if (t < hm(day.start) || t >= hm(day.end)) {
          e.time = `Outside working hours (${day.start}–${day.end}).`;
        } else if (t + durationMin > hm(day.end)) {
          e.time = `Not enough time before close (${day.end}).`;
        } else if (day.breaks?.some((b) => t < hm(b.end) && t + durationMin > hm(b.start))) {
          e.time = "That overlaps a break.";
        }
      }
    }
    return e;
  }, [clientId, serviceId, counsellorId, date, time, isOnline, roomId, durationMin, options.businessHours]);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;
    start(async () => {
      const res = await createAppointment({
        orgId: options.orgId,
        clientId: clientId!,
        serviceId: serviceId!,
        counsellorId: counsellorId!,
        type: isOnline ? "online" : "in_person",
        roomId: isOnline ? null : roomId,
        date,
        time,
        durationMin,
        recurring,
        recurringCount: recurring ? recurringCount : null,
        notes: notes || undefined,
        sendConfirmation,
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const name = clients.find((c) => c.id === clientId)?.name ?? "client";
      const seriesNote = recurring ? (recurringCount ? ` · ${recurringCount}-session series` : " · ongoing series") : "";
      toast({ tone: "success", title: "Appointment created", description: (sendConfirmation ? `${name} was notified by email + in-app.` : `Booked for ${name}.`) + seriesNote });
      onClose();
    });
  };

  // Create a client inline  the counsellor selected below becomes their primary.
  const addNewClient = () => {
    setNcError(null);
    if (!counsellorId) { setNcError("Choose the counsellor below first  they become this client's primary counsellor."); return; }
    startCreate(async () => {
      const res = await createClientForBooking({ orgId: options.orgId, name: nc.name, phone: nc.phone, email: nc.email, counsellorId });
      if (!res.ok) { setNcError(res.error); return; }
      setClients((prev) => [{ id: res.client.id, name: res.client.name }, ...prev]);
      setClientId(res.client.id);
      setNewClientOpen(false);
      setNc({ name: "", phone: "", email: "" });
      toast({ tone: "success", title: `${res.client.name} added`, description: "Selected for this booking." });
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New appointment"
      description="Book a session  it appears on the calendar straight away."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} loading={pending}>Create appointment</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Row label="Client" error={attempted && !newClientOpen ? errors.client : undefined}>
          {newClientOpen ? (
            <div className="space-y-2.5 rounded-control border border-accent/30 bg-accent-soft/15 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-[620] text-text"><UserPlus className="size-3.5 text-accent" strokeWidth={2} aria-hidden /> New client</span>
                <button type="button" onClick={() => { setNewClientOpen(false); setNcError(null); }} className="text-text-3 transition-colors hover:text-text" aria-label="Cancel new client"><X className="size-4" strokeWidth={2} aria-hidden /></button>
              </div>
              <Input value={nc.name} onChange={(e) => setNc((v) => ({ ...v, name: e.target.value }))} placeholder="Full name" aria-label="Client full name" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={nc.phone} onChange={(e) => setNc((v) => ({ ...v, phone: e.target.value }))} placeholder="Phone · 082…" aria-label="Client phone" />
                <Input value={nc.email} onChange={(e) => setNc((v) => ({ ...v, email: e.target.value }))} placeholder="Email" aria-label="Client email" />
              </div>
              {ncError && <p className="flex items-center gap-1.5 text-[12px] text-danger"><AlertCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> {ncError}</p>}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-text-3">The counsellor you pick below becomes their primary.</span>
                <Button size="sm" onClick={addNewClient} loading={creating} disabled={!nc.name.trim()}>Add client</Button>
              </div>
            </div>
          ) : (
            <SearchSelect
              value={clientId}
              onChange={setClientId}
              invalid={Boolean(attempted && errors.client)}
              placeholder="Choose a client"
              searchPlaceholder="Search clients…"
              ariaLabel="Client"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              footer={(close) => (
                <button type="button" onClick={() => { close(); setNewClientOpen(true); setNcError(null); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-[620] text-accent transition-colors hover:bg-accent-soft/40">
                  <Plus className="size-4" strokeWidth={2.2} aria-hidden /> New client
                </button>
              )}
            />
          )}
        </Row>
        <Row label="Service" error={attempted ? errors.service : undefined}>
          <Select value={serviceId} onChange={onService} invalid={Boolean(attempted && errors.service)} placeholder="Choose a service" options={options.services.map((s) => ({ value: s.id, label: s.name, hint: `${s.durationMin} min` }))} />
        </Row>
        <Row label="Counsellor" error={attempted ? errors.counsellor : undefined}>
          <SearchSelect value={counsellorId} onChange={setCounsellorId} invalid={Boolean(attempted && errors.counsellor)} placeholder="Choose a counsellor" searchPlaceholder="Search counsellors…" ariaLabel="Counsellor" options={options.counsellors.map((c) => ({ value: c.id, label: c.name }))} />
        </Row>

        <Row label="Where">
          <div className="grid grid-cols-2 gap-2.5">
            <WhereCard active={!isOnline} icon={MapPin} title="In person" desc="At your practice room" onClick={() => setType("In person")} />
            <WhereCard active={isOnline} icon={Video} title="Online" desc="Secure video room" onClick={() => { setType("Online"); setRoomId(null); }} />
          </div>
        </Row>
        {!isOnline && (
          <Row label="Room" error={attempted ? errors.room : undefined}>
            <Select value={roomId} onChange={setRoomId} invalid={Boolean(attempted && errors.room)} placeholder="Choose a room" options={options.rooms.map((r) => ({ value: r.id, label: r.name }))} />
          </Row>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Row label="Date" error={attempted ? errors.date : undefined}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={Boolean(attempted && errors.date)} />
          </Row>
          <Row label="Time" error={attempted ? errors.time : undefined}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} invalid={Boolean(attempted && errors.time)} />
          </Row>
        </div>

        <Row label="Duration">
          <Select value={String(durationMin)} onChange={(v) => setDurationMin(Number(v))} options={DURATIONS.map((d) => ({ value: String(d), label: `${d} minutes` }))} />
        </Row>

        <Toggle label="Repeat weekly" checked={recurring} onChange={setRecurring} hint="Create a recurring series." />

        {recurring && (
          <Row label="How many">
            <Select
              value={recurringCount === null ? "0" : String(recurringCount)}
              onChange={(v) => setRecurringCount(v === "0" ? null : Number(v))}
              options={[
                { value: "4", label: "4 sessions" },
                { value: "6", label: "6 sessions" },
                { value: "8", label: "8 sessions" },
                { value: "12", label: "12 sessions" },
                { value: "24", label: "24 sessions" },
                { value: "0", label: "Ongoing (no end date)" },
              ]}
            />
          </Row>
        )}

        <Row label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the counsellor should know (optional)" className="min-h-[72px]" />
        </Row>

        <Toggle label="Notify client & counsellor" checked={sendConfirmation} onChange={setSendConfirmation} hint="In-app now + an email confirmation (SMS is opt-in)." />
      </div>
    </Dialog>
  );
}

function WhereCard({ active, icon: Icon, title, desc, onClick }: { active: boolean; icon: typeof MapPin; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-2.5 rounded-control border p-3 text-left transition-colors",
        active ? "border-accent bg-accent-soft/40 ring-1 ring-accent/30" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors", active ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
        <Icon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13.5px] font-[620] text-text">{title}{active && <Check className="size-3.5 text-accent" strokeWidth={2.6} aria-hidden />}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-text-3">{desc}</span>
      </span>
    </button>
  );
}

function Row({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface p-3">
      <div>
        <div className="text-[13.5px] font-medium text-text">{label}</div>
        {hint ? <div className="text-[12px] text-text-3">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors", checked ? "bg-accent" : "bg-border-strong")}
      >
        <span className={cn("inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-4" : "translate-x-0")}>
          {checked ? <Check className="size-3 text-accent" strokeWidth={3} aria-hidden /> : null}
        </span>
      </button>
    </div>
  );
}
