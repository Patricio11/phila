"use client";

import { CalendarDays, Clock, MessageCircle, User } from "lucide-react";
import type { BookingConfig } from "@/lib/data-provider";
import type { BookingState } from "@/components/booking/types";
import { StepHeader } from "@/components/booking/step-header";

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

export function ConfirmStep({
  config,
  state,
  error,
}: {
  config: BookingConfig;
  state: BookingState;
  error: string | null;
}) {
  const service = config.services.find((s) => s.id === state.serviceId);
  const counsellor = config.counsellors.find((c) => c.id === state.slotCounsellorId);
  const name = state.intake.full_name ?? "";
  const contact = state.intake.preferred_contact ?? "your preferred channel";

  return (
    <div>
      <StepHeader title="Confirm your session" subtitle="A last look before we book it." />

      <dl className="divide-y divide-border rounded-control border border-border">
        <Row icon={<CalendarDays className="size-[18px]" />} label="When" value={state.slotStart ? formatWhen(state.slotStart) : "—"} />
        <Row icon={<Clock className="size-[18px]" />} label="Service" value={service ? `${service.name} · ${service.durationMin} min` : "—"} />
        <Row icon={<User className="size-[18px]" />} label="Counsellor" value={counsellor?.name ?? "Any available"} />
        <Row icon={<MessageCircle className="size-[18px]" />} label="We'll reach you via" value={contact} />
      </dl>

      <div className="mt-4 rounded-control bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-text-2">
        We&apos;ll create a private Phila account for{" "}
        <span className="font-medium text-text">{name || "you"}</span> so you can see this session,
        join online, and manage your bookings. Your details stay confidential under POPIA.
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="text-text-3" aria-hidden>
        {icon}
      </span>
      <span className="w-28 shrink-0 text-[12.5px] text-text-3">{label}</span>
      <span className="min-w-0 flex-1 text-[13.5px] font-medium text-text">{value}</span>
    </div>
  );
}
