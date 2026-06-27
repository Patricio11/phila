"use client";

import { ShieldCheck } from "lucide-react";
import type { Org } from "@/lib/mock/types";
import type { BookingState } from "@/components/booking/types";
import { ConsentField, type ConsentSpec } from "@/components/booking/consent-field";
import { StepHeader } from "@/components/booking/step-header";
import { hasRequiredConsents } from "@/components/booking/validation";

/**
 * Consent specs for booking — affirmative, never pre-ticked (POPIA). The AI
 * purpose only appears when the org has the AI feature on (Dormant-by-Default:
 * the toggle is also the cross-border consent gate).
 */
function specsFor(org: Org): ConsentSpec[] {
  const specs: ConsentSpec[] = [
    {
      purpose: "booking",
      required: true,
      title: "Booking & appointments",
      description: "So we can schedule your sessions and manage changes.",
    },
    {
      purpose: "notes",
      required: true,
      title: "Confidential clinical notes",
      description:
        "So your counsellor can keep private notes to support your care. Only your counsellor (and their supervisor) can read them.",
    },
    {
      purpose: "comms",
      title: "Reminders & messages",
      description: "Appointment reminders and updates by WhatsApp, SMS, or email. You can opt out any time.",
    },
    {
      purpose: "demographics",
      title: "Demographic information",
      description:
        "Anonymous stats like age band and province, used only for reporting. It never identifies you on any shared view.",
    },
    {
      purpose: "funder_reporting",
      title: "Anonymous funder reporting",
      description:
        "Let your de-identified progress count toward the programme's funded targets — aggregate figures only, never a record of you.",
    },
  ];

  if (org.features.ai) {
    specs.push({
      purpose: "ai_processing",
      title: "AI-assisted notes",
      description:
        "Allow AI to help draft your counsellor's notes. Your counsellor always reviews and signs; data is de-identified first.",
    });
  }
  return specs;
}

export function ConsentStep({
  org,
  consents,
  onChange,
  showError,
}: {
  org: Org;
  consents: BookingState["consents"];
  onChange: (purpose: ConsentSpec["purpose"], checked: boolean) => void;
  showError: boolean;
}) {
  const specs = specsFor(org);
  const blocked = showError && !hasRequiredConsents(consents);

  return (
    <div>
      <StepHeader
        title="Your consent"
        subtitle="You choose what you agree to. Nothing is pre-ticked, and you can change any of these later."
      />

      <div className="space-y-2.5">
        {specs.map((spec) => (
          <ConsentField
            key={spec.purpose}
            spec={spec}
            checked={Boolean(consents[spec.purpose])}
            onChange={(c) => onChange(spec.purpose, c)}
          />
        ))}
      </div>

      {blocked ? (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
          Booking and confidential-notes consent are needed before we can book your session.
        </p>
      ) : (
        <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-text-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          Your information is special personal information under POPIA. It&apos;s kept confidential,
          and every access is recorded.
        </p>
      )}
    </div>
  );
}
