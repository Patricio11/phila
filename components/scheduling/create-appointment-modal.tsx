"use client";

import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, Textarea, RadioGroup, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createAppointment } from "@/lib/scheduling/actions";
import { cn } from "@/lib/utils";

export interface SchedulingOptions {
  orgId: string;
  clients: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number }[];
  counsellors: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  defaultCounsellorId?: string;
}

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
  const [attempted, setAttempted] = useState(false);

  const [clientId, setClientId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [counsellorId, setCounsellorId] = useState<string | null>(initial?.counsellorId ?? options.defaultCounsellorId ?? null);
  const [type, setType] = useState(initial?.type ?? "In person");
  const [roomId, setRoomId] = useState<string | null>(initial?.roomId ?? null);
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [durationMin, setDurationMin] = useState(60);
  const [recurring, setRecurring] = useState(false);
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
    return e;
  }, [clientId, serviceId, counsellorId, date, time, isOnline, roomId]);

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
        notes: notes || undefined,
        sendConfirmation,
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const name = options.clients.find((c) => c.id === clientId)?.name ?? "client";
      toast({ tone: "success", title: "Appointment created", description: sendConfirmation ? `${name} will be sent a confirmation once messaging is set up.` : `Booked for ${name}.` });
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New appointment"
      description="Book a session — it appears on the calendar straight away."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} loading={pending}>Create appointment</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Row label="Client" error={attempted ? errors.client : undefined}>
          <Select value={clientId} onChange={setClientId} invalid={Boolean(attempted && errors.client)} placeholder="Choose a client" options={options.clients.map((c) => ({ value: c.id, label: c.name }))} />
        </Row>
        <Row label="Service" error={attempted ? errors.service : undefined}>
          <Select value={serviceId} onChange={onService} invalid={Boolean(attempted && errors.service)} placeholder="Choose a service" options={options.services.map((s) => ({ value: s.id, label: s.name, hint: `${s.durationMin} min` }))} />
        </Row>
        <Row label="Counsellor" error={attempted ? errors.counsellor : undefined}>
          <Select value={counsellorId} onChange={setCounsellorId} invalid={Boolean(attempted && errors.counsellor)} placeholder="Choose a counsellor" options={options.counsellors.map((c) => ({ value: c.id, label: c.name }))} />
        </Row>

        <Row label="Where">
          <RadioGroup options={["In person", "Online"]} value={type} onChange={(v) => { setType(v as "In person" | "Online"); if (v === "Online") setRoomId(null); }} />
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

        <Row label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the counsellor should know (optional)" className="min-h-[72px]" />
        </Row>

        <Toggle label="Send a confirmation" checked={sendConfirmation} onChange={setSendConfirmation} hint="WhatsApp + email, when messaging is set up." />
      </div>
    </Dialog>
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
