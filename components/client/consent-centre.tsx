"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  CONSENT_PURPOSE_LABELS,
  type ConsentPurpose,
} from "@/lib/domain/enums";
import type { ConsentRecord } from "@/lib/mock/types";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Plain-English descriptions for the consent centre. */
const DESCRIPTIONS: Record<ConsentPurpose, string> = {
  booking: "Lets us schedule and manage your sessions.",
  notes: "Lets your counsellor keep confidential notes to support your care.",
  demographics: "Anonymous stats used only for reporting — never identifies you.",
  ai_processing: "Lets AI help draft your counsellor's notes (always reviewed and signed by them).",
  comms: "Appointment reminders and updates by WhatsApp, SMS, or email.",
  care_plan_share: "Lets your counsellor share a care plan and tasks with you.",
  funder_reporting: "Lets your de-identified progress count toward funded programme targets.",
};

/** Order shown — the foundational purposes first. */
const ORDER: ConsentPurpose[] = [
  "booking",
  "notes",
  "care_plan_share",
  "comms",
  "demographics",
  "funder_reporting",
  "ai_processing",
];

type State = "granted" | "revoked" | "none";

export function ConsentCentre({ records }: { records: ConsentRecord[] }) {
  const { toast } = useToast();
  const initial = new Map<ConsentPurpose, State>();
  for (const r of records) initial.set(r.purpose, r.state);

  const [states, setStates] = useState<Map<ConsentPurpose, State>>(initial);

  // Only purposes the client actually has a relationship with are shown.
  const purposes = ORDER.filter((p) => states.has(p));

  const toggle = (purpose: ConsentPurpose) => {
    setStates((prev) => {
      const next = new Map(prev);
      const on = prev.get(purpose) === "granted";
      next.set(purpose, on ? "revoked" : "granted");
      toast({
        tone: on ? "default" : "success",
        title: on ? `Turned off: ${CONSENT_PURPOSE_LABELS[purpose]}` : `Turned on: ${CONSENT_PURPOSE_LABELS[purpose]}`,
        description: on
          ? "This takes effect right away. You can turn it back on any time."
          : "Thank you — this takes effect right away.",
      });
      return next;
    });
  };

  return (
    <div className="space-y-2.5">
      {purposes.map((purpose) => {
        const on = states.get(purpose) === "granted";
        return (
          <div
            key={purpose}
            className={cn(
              "flex items-start gap-3 rounded-card border p-4 transition-colors",
              on ? "border-border bg-surface" : "border-border bg-surface-2/50",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-[600] text-text">
                  {CONSENT_PURPOSE_LABELS[purpose]}
                </span>
                <span
                  className={cn(
                    "rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold",
                    on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3",
                  )}
                >
                  {on ? "On" : "Off"}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{DESCRIPTIONS[purpose]}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? "Turn off" : "Turn on"} ${CONSENT_PURPOSE_LABELS[purpose]}`}
              onClick={() => toggle(purpose)}
              className={cn(
                "mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
                on ? "bg-accent" : "bg-border-strong",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform",
                  on ? "translate-x-4" : "translate-x-0",
                )}
              >
                {on ? <Check className="size-3 text-accent" strokeWidth={3} aria-hidden /> : null}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
