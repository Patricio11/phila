"use client";

import { Check, Clock, Users } from "lucide-react";
import type { Counsellor, Service } from "@/lib/mock/types";
import { StepHeader } from "@/components/booking/step-header";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { cn } from "@/lib/utils";

export function ServiceStep({
  services,
  counsellors,
  serviceId,
  counsellorId,
  onService,
  onCounsellor,
}: {
  services: Service[];
  counsellors: Counsellor[];
  serviceId: string | null;
  counsellorId: string | null;
  onService: (id: string) => void;
  onCounsellor: (id: string | null) => void;
}) {
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
