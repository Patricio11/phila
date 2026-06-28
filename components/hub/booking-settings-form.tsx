"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, Save, Wallet } from "lucide-react";
import type { BookingSettings } from "@/lib/data-provider";
import type { Counsellor, Service } from "@/lib/domain/types";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { useToast } from "@/components/ui/toast";
import { saveBookingSettings } from "@/app/hub/booking/actions";
import { cn } from "@/lib/utils";

const NOTICE = [
  { value: "0", label: "No minimum" },
  { value: "2", label: "2 hours" },
  { value: "4", label: "4 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
];
const HORIZON = [
  { value: "14", label: "2 weeks" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
];

const rands = (cents: number | null) => (cents === null ? "Enquire" : `R${(cents / 100).toLocaleString("en-ZA")}`);

export function BookingSettingsForm({
  initial,
  services,
  counsellors,
  orgSlug,
}: {
  initial: BookingSettings;
  services: Service[];
  counsellors: Counsellor[];
  orgSlug: string;
}) {
  const { toast } = useToast();
  const [s, setS] = useState<BookingSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<BookingSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const svc = (id: string, patch: Partial<BookingSettings["services"][number]>) =>
    set({ services: s.services.map((p) => (p.serviceId === id ? { ...p, ...patch } : p)) });
  const cns = (id: string, patch: Partial<BookingSettings["counsellors"][number]>) =>
    set({ counsellors: s.counsellors.map((p) => (p.counsellorId === id ? { ...p, ...patch } : p)) });

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveBookingSettings(s);
    setSaving(false);
    if (res.ok) toast({ tone: "success", title: "Booking settings saved", description: "Your public booking page now reflects these." });
    else setError(res.error);
  };

  const nameOfService = (id: string) => services.find((x) => x.id === id);
  const nameOfCounsellor = (id: string) => counsellors.find((x) => x.id === id);
  const bookableCount = s.services.filter((p) => p.publiclyBookable).length;

  return (
    <div className="space-y-5">
      {/* Master switch */}
      <Card className="p-5">
        <Row
          title="Public online booking"
          desc={s.publicBookingEnabled ? "Clients can book themselves on your public page." : "Booking is invite-only — your public page shows a 'contact us' message."}
          on={s.publicBookingEnabled}
          onToggle={() => set({ publicBookingEnabled: !s.publicBookingEnabled })}
        />
        {s.publicBookingEnabled && (
          <Link href={`/o/${orgSlug}/book`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
            <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden /> Preview your booking page
          </Link>
        )}
      </Card>

      <div className={cn("space-y-5 transition-opacity", !s.publicBookingEnabled && "pointer-events-none opacity-50")}>
        {/* Notice & horizon */}
        <Card>
          <CardHead title="When clients can book" />
          <div className="grid gap-4 px-[17px] pb-[17px] sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Minimum notice</Label>
              <Select value={String(s.minNoticeHours)} options={NOTICE} onChange={(v) => set({ minNoticeHours: Number(v) })} />
              <p className="text-[11.5px] text-text-3">How close to the start a client may still book.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Booking opens</Label>
              <Select value={String(s.maxDaysAhead)} options={HORIZON} onChange={(v) => set({ maxDaysAhead: Number(v) })} />
              <p className="text-[11.5px] text-text-3">How far ahead the calendar is open.</p>
            </div>
          </div>
        </Card>

        {/* Services */}
        <Card>
          <CardHead title="Services clients can book" count={bookableCount} />
          <div className="divide-y divide-border">
            {s.services.map((p) => {
              const info = nameOfService(p.serviceId);
              return (
                <div key={p.serviceId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[17px] py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-text">{info?.name ?? p.serviceId}</div>
                    <div className="text-[11.5px] text-text-3">{info ? `${info.durationMin} min · ${rands(info.priceCents)}` : ""}</div>
                  </div>
                  <Chip on={p.publiclyBookable} onClick={() => svc(p.serviceId, { publiclyBookable: !p.publiclyBookable })}>Bookable</Chip>
                  <Chip on={p.inPerson} disabled={!p.publiclyBookable} onClick={() => svc(p.serviceId, { inPerson: !p.inPerson })}>In-person</Chip>
                  <Chip on={p.online} disabled={!p.publiclyBookable} onClick={() => svc(p.serviceId, { online: !p.online })}>Online</Chip>
                </div>
              );
            })}
          </div>
          <p className="px-[17px] pb-[15px] pt-1 text-[11.5px] text-text-3">A service that&apos;s off stays available internally — it just isn&apos;t offered for self-booking.</p>
        </Card>

        {/* Counsellors */}
        <Card>
          <CardHead title="Counsellors taking public bookings" count={s.counsellors.filter((c) => c.publiclyBookable).length} />
          <div className="divide-y divide-border">
            {s.counsellors.map((p) => {
              const c = nameOfCounsellor(p.counsellorId);
              return (
                <div key={p.counsellorId} className="flex items-center gap-3 px-[17px] py-3">
                  <Avatar name={c?.name ?? "?"} size="sm" verified={c?.credential.status === "verified"} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-text">{c?.name ?? p.counsellorId}</div>
                    {c && <div className="mt-0.5"><CredentialChip body={c.credential.body} status={c.credential.status} /></div>}
                  </div>
                  <Chip on={p.publiclyBookable} onClick={() => cns(p.counsellorId, { publiclyBookable: !p.publiclyBookable })}>Bookable</Chip>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Intake + deposit */}
        <Card className="p-5">
          <Row
            title="Collect the intake form during booking"
            desc="Off sends it afterwards by message instead."
            on={s.requireIntake}
            onToggle={() => set({ requireIntake: !s.requireIntake })}
            icon={ClipboardList}
          />
          <Link href="/hub/intake/form" className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
            Edit the intake questions
          </Link>
          <div className="my-4 h-px bg-border" />
          <Row
            title="Require a deposit to confirm"
            desc="Hold the slot only once a deposit is paid."
            on={s.requireDeposit}
            onToggle={() => set({ requireDeposit: !s.requireDeposit })}
            icon={Wallet}
          />
          {s.requireDeposit && (
            <div className="mt-3 max-w-[200px] space-y-1.5">
              <Label htmlFor="deposit">Deposit amount (R)</Label>
              <Input id="deposit" type="number" min={0} value={s.depositCents ? s.depositCents / 100 : ""} onChange={(e) => set({ depositCents: Math.round(Number(e.target.value || 0) * 100) })} placeholder="e.g. 150" />
            </div>
          )}
        </Card>
      </div>

      <FieldError>{error}</FieldError>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 rounded-card border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
        <Button onClick={save} loading={saving}>
          <Save className="size-4" strokeWidth={2} aria-hidden /> Save settings
        </Button>
      </div>
    </div>
  );
}

function Row({ title, desc, on, onToggle, icon: Icon }: { title: string; desc: string; on: boolean; onToggle: () => void; icon?: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} />}
        <div>
          <div className="text-[13.5px] font-medium text-text">{title}</div>
          <div className="mt-0.5 text-[12px] text-text-2">{desc}</div>
        </div>
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center rounded-control border px-2.5 text-[12px] font-medium transition-colors disabled:opacity-40",
        on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
      )}
    >
      {children}
    </button>
  );
}
