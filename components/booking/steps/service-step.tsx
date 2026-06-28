"use client";

import { Check, Clock, MapPin, Users, Video } from "lucide-react";
import type { Counsellor, Service } from "@/lib/domain/types";
import type { BookingState } from "@/components/booking/types";
import { StepHeader } from "@/components/booking/step-header";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { cn } from "@/lib/utils";

export function ServiceStep({
  services,
  counsellors,
  serviceModalities,
  serviceId,
  modality,
  counsellorId,
  onService,
  onModality,
  onCounsellor,
}: {
  services: Service[];
  counsellors: Counsellor[];
  serviceModalities: Record<string, { inPerson: boolean; online: boolean }>;
  serviceId: string | null;
  modality: BookingState["modality"];
  counsellorId: string | null;
  onService: (id: string) => void;
  onModality: (m: "in_person" | "online") => void;
  onCounsellor: (id: string | null) => void;
}) {
  const m = serviceId ? serviceModalities[serviceId] : undefined;
  const bothModalities = Boolean(m?.inPerson && m?.online);
  return (
    <div>
      <StepHeader
        title="What would you like to book?"
        subtitle="Choose a service, and a counsellor if you have a preference."
      />

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-text-2">Service</legend>
        <div className="space-y-2">
          {services.map((s) => {
            const selected = serviceId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onService(s.id)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-control border p-3.5 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent-soft/50"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-[600] text-text">{s.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-3">
                    <Clock className="size-3.5" strokeWidth={2} aria-hidden /> {s.durationMin} min
                  </span>
                </span>
                <span className="text-[14px] font-semibold tabular-nums text-text">
                  {s.priceCents === null ? "Enquire" : `R${(s.priceCents / 100).toLocaleString("en-ZA")}`}
                </span>
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full border",
                    selected ? "border-accent bg-accent text-accent-ink" : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {bothModalities && (
        <fieldset className="mt-6">
          <legend className="mb-2 text-[13px] font-semibold text-text-2">How would you like to meet?</legend>
          <div className="grid grid-cols-2 gap-2">
            <ModalityCard selected={modality === "in_person"} onClick={() => onModality("in_person")} icon={<MapPin className="size-[18px]" strokeWidth={1.9} aria-hidden />} title="In person" subtitle="At the practice" />
            <ModalityCard selected={modality === "online"} onClick={() => onModality("online")} icon={<Video className="size-[18px]" strokeWidth={1.9} aria-hidden />} title="Online" subtitle="Secure video session" />
          </div>
        </fieldset>
      )}

      <fieldset className="mt-6">
        <legend className="mb-2 text-[13px] font-semibold text-text-2">Counsellor</legend>
        <div className="space-y-2">
          <CounsellorRow
            selected={counsellorId === null}
            onClick={() => onCounsellor(null)}
            title="Any available"
            subtitle="We'll match you with the first open counsellor"
            anyAvailable
          />
          {counsellors.map((c) => (
            <CounsellorRow
              key={c.id}
              selected={counsellorId === c.id}
              onClick={() => onCounsellor(c.id)}
              title={c.name}
              counsellor={c}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function CounsellorRow({
  selected,
  onClick,
  title,
  subtitle,
  counsellor,
  anyAvailable = false,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  counsellor?: Counsellor;
  anyAvailable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-control border p-3 text-left transition-colors",
        selected ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      {anyAvailable ? (
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-3">
          <Users className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </span>
      ) : (
        <Avatar name={title} size="md" verified={counsellor?.credential.status === "verified"} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-[600] text-text">{title}</span>
        {subtitle ? <span className="block text-[12px] text-text-3">{subtitle}</span> : null}
        {counsellor ? (
          <span className="mt-1 inline-block">
            <CredentialChip body={counsellor.credential.body} status={counsellor.credential.status} />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full border",
          selected ? "border-accent bg-accent text-accent-ink" : "border-border-strong",
        )}
        aria-hidden
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

function ModalityCard({ selected, onClick, icon, title, subtitle }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-1 rounded-control border p-3.5 text-left transition-colors",
        selected ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <span className={cn("inline-flex size-8 items-center justify-center rounded-full", selected ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-3")}>{icon}</span>
      <span className="mt-1 text-[13.5px] font-[600] text-text">{title}</span>
      <span className="text-[12px] text-text-3">{subtitle}</span>
    </button>
  );
}
