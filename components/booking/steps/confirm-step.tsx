"use client";

import { CalendarDays, Clock, MapPin, MessageCircle, User, Video, Wallet } from "lucide-react";
import type { BookingConfig } from "@/lib/data-provider";
import type { BookingState } from "@/components/booking/types";
import { StepHeader } from "@/components/booking/step-header";
import { Checkbox } from "@/components/ui/checkbox";

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
  accepted,
  onAccept,
  inviteOnBooking,
}: {
  config: BookingConfig;
  state: BookingState;
  error: string | null;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  inviteOnBooking: boolean;
}) {
  const service = config.services.find((s) => s.id === state.serviceId);
  const counsellor = config.counsellors.find((c) => c.id === state.slotCounsellorId);
  const name = state.intake.full_name ?? "";
  const contact = state.intake.preferred_contact ?? "your preferred channel";
  const online = state.modality === "online";
  const deposit = config.deposit.required && config.deposit.cents > 0;

  return (
    <div>
      <StepHeader title="Confirm your session" subtitle="A last look before we book it." />

      <dl className="divide-y divide-border rounded-control border border-border">
        <Row icon={<CalendarDays className="size-[18px]" />} label="When" value={state.slotStart ? formatWhen(state.slotStart) : ""} />
        <Row icon={<Clock className="size-[18px]" />} label="Service" value={service ? `${service.name} · ${service.durationMin} min` : ""} />
        {state.modality ? (
          <Row icon={online ? <Video className="size-[18px]" /> : <MapPin className="size-[18px]" />} label="How" value={online ? "Online · secure video session" : "In person · at the practice"} />
        ) : null}
        <Row icon={<User className="size-[18px]" />} label="Counsellor" value={counsellor?.name ?? "Any available"} />
        <Row icon={<MessageCircle className="size-[18px]" />} label="We'll reach you via" value={contact} />
      </dl>

      {deposit ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-control border border-border bg-surface-2/50 p-3.5">
          <Wallet className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-text-2">
            A deposit of <span className="font-semibold text-text">R{(config.deposit.cents / 100).toLocaleString("en-ZA")}</span> confirms your slot. You&apos;ll be prompted to pay securely right after booking.
          </p>
        </div>
      ) : null}

      {/* Only when the practice invites clients to the portal on booking (off by
          default) do we mention an account  otherwise the client just books. */}
      {inviteOnBooking ? (
        <div className="mt-4 rounded-control bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-text-2">
          We&apos;ll send{" "}
          <span className="font-medium text-text">{name || "you"}</span> a link to set up a private Phila
          account  so you can see this session, join online, and manage your bookings. Your details stay
          confidential under POPIA.
        </div>
      ) : null}

      {/* One affirmative acceptance in place of a page of toggles  the terms carry the detail. */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface p-3.5 transition-colors hover:bg-surface-hover">
        <Checkbox
          checked={accepted}
          onChange={onAccept}
          ariaLabel="Accept the terms and privacy policy"
          fillClassName="border-[var(--brand)] bg-[var(--brand)]"
          className="mt-0.5"
        />
        <span className="text-[13px] leading-relaxed text-text-2">
          I&apos;ve read and accept the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-text underline decoration-border-strong underline-offset-2 hover:text-accent"
          >
            Terms &amp; Conditions
          </a>
          {" "} including how my sessions, notes, reminders, and de-identified reporting information are handled, kept confidential, and recorded under POPIA.
        </span>
      </label>

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
