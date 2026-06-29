"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CloudUpload, Loader2 } from "lucide-react";
import type { BookingConfig } from "@/lib/data-provider";
import { CONSENT_PURPOSES, type ConsentPurpose } from "@/lib/domain/enums";
import { contrastSafeAccent } from "@/lib/contrast";
import { submitBooking, type BookingConfirmation } from "@/app/o/[slug]/book/actions";
import { enqueueBooking } from "@/lib/pwa/queue-client";
import { BookingShell, type BookingStepMeta } from "@/components/booking/booking-shell";
import { EMPTY_BOOKING, type BookingState } from "@/components/booking/types";
import { isIntakeValid, hasRequiredConsents } from "@/components/booking/validation";
import { ServiceStep } from "@/components/booking/steps/service-step";
import { TimeStep } from "@/components/booking/steps/time-step";
import { IntakeStep } from "@/components/booking/steps/intake-step";
import { ConsentStep } from "@/components/booking/steps/consent-step";
import { ConfirmStep } from "@/components/booking/steps/confirm-step";
import { SuccessStep } from "@/components/booking/steps/success-step";
import { cn } from "@/lib/utils";

const STEPS: BookingStepMeta[] = [
  { key: "service", label: "Service" },
  { key: "time", label: "Time" },
  { key: "intake", label: "About you" },
  { key: "consent", label: "Consent" },
  { key: "confirm", label: "Confirm" },
];

type Saved = { state: BookingState; step: number };

function storageKey(slug: string) {
  return `phila-booking-${slug}`;
}

function loadSaved(slug: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function BookingWizard({
  config,
  initialServiceId,
}: {
  config: BookingConfig;
  initialServiceId: string | null;
}) {
  const { org } = config;
  const slug = org.slug;
  const brand = contrastSafeAccent(org.brandAccent);

  const [state, setState] = useState<BookingState>({
    ...EMPTY_BOOKING,
    serviceId: initialServiceId,
  });
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [queued, setQueued] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Resume a prior draft (deferred setState → not a synchronous effect update).
  useEffect(() => {
    const saved = loadSaved(slug);
    if (!saved) return;
    const raf = requestAnimationFrame(() => {
      setState(saved.state);
      setStep(Math.min(saved.step, STEPS.length - 1));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft as it changes (no setState here).
  useEffect(() => {
    if (confirmation) return;
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify({ state, step }));
    } catch {
      /* storage disabled  the draft simply won't survive a refresh */
    }
  }, [slug, state, step, confirmation]);

  const selectedService = config.services.find((s) => s.id === state.serviceId);
  const durationMin = selectedService?.durationMin ?? org.scheduling.defaultDurationMin;

  function patch(next: Partial<BookingState>) {
    setState((prev) => ({ ...prev, ...next }));
  }

  function defaultModality(svcId: string): BookingState["modality"] {
    const mm = config.serviceModalities[svcId];
    if (!mm) return null;
    if (mm.inPerson && mm.online) return null; // both offered → the client must choose
    return mm.online ? "online" : "in_person";
  }

  const canAdvance = (() => {
    switch (step) {
      case 0:
        return Boolean(state.serviceId) && Boolean(state.modality);
      case 1:
        return Boolean(state.slotStart);
      case 2:
        return isIntakeValid(config.intakeForm.fields, state.intake);
      case 3:
        return hasRequiredConsents(state.consents);
      default:
        return true;
    }
  })();

  function goNext() {
    if (!canAdvance) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setShowErrors(false);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleConfirm() {
    if (!state.serviceId || !state.slotStart || !state.slotCounsellorId) return;
    setSubmitError(null);
    const consents = Object.fromEntries(
      CONSENT_PURPOSES.map((p) => [p, Boolean(state.consents[p])]),
    ) as Record<ConsentPurpose, boolean>;
    const payload = {
      slug,
      serviceId: state.serviceId!,
      counsellorId: state.slotCounsellorId!,
      startsAt: state.slotStart!,
      modality: state.modality ?? ("in_person" as const),
      intake: state.intake,
      consents,
    };

    // Offline: queue it durably and be honest — it sends on reconnect, not now.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      startSubmit(async () => {
        await enqueueBooking(payload, `Booking · ${payload.startsAt.slice(0, 10)}`);
        try { localStorage.removeItem(storageKey(slug)); } catch { /* ignore */ }
        setQueued(true);
      });
      return;
    }

    startSubmit(async () => {
      const res = await submitBooking(payload);
      if (res.ok) {
        setConfirmation(res.confirmation);
        try {
          localStorage.removeItem(storageKey(slug));
        } catch {
          /* ignore */
        }
      } else {
        setSubmitError(res.error);
      }
    });
  }

  if (queued) {
    return (
      <BookingShell orgName={org.name} orgSlug={slug} brand={brand} steps={STEPS} current={STEPS.length - 1}>
        <div className="mx-auto max-w-md space-y-3 py-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <CloudUpload className="size-6" strokeWidth={2} aria-hidden />
          </div>
          <h2 className="text-[19px] font-[680] text-text">Saved on your device</h2>
          <p className="text-[14px] leading-relaxed text-text-2">
            You&apos;re offline, so we haven&apos;t sent this yet  nothing was booked. It&apos;s saved here and will
            send automatically the moment you&apos;re back online, then {org.name} confirms the time.
          </p>
          <p className="text-[12.5px] text-text-3">Keep this device online to send it. The badge below shows it&apos;s waiting.</p>
        </div>
      </BookingShell>
    );
  }

  if (confirmation) {
    return (
      <BookingShell orgName={org.name} orgSlug={slug} brand={brand} steps={STEPS} current={STEPS.length - 1}>
        <SuccessStep
          confirmation={confirmation}
          orgName={org.name}
          orgSlug={slug}
          preferredContact={state.intake.preferred_contact ?? "email and WhatsApp"}
        />
      </BookingShell>
    );
  }

  const isConfirm = step === STEPS.length - 1;

  return (
    <BookingShell orgName={org.name} orgSlug={slug} brand={brand} steps={STEPS} current={step}>
      {step === 0 && (
        <ServiceStep
          services={config.services}
          counsellors={config.counsellors}
          serviceModalities={config.serviceModalities}
          serviceId={state.serviceId}
          modality={state.modality}
          counsellorId={state.counsellorId}
          onService={(id) => patch({ serviceId: id, modality: defaultModality(id), date: null, slotStart: null, slotCounsellorId: null })}
          onModality={(modality) => patch({ modality })}
          onCounsellor={(id) => patch({ counsellorId: id, slotStart: null, slotCounsellorId: null })}
        />
      )}
      {step === 1 && (
        <TimeStep
          slug={slug}
          businessHours={org.scheduling.businessHours}
          durationMin={durationMin}
          maxDaysAhead={config.maxDaysAhead}
          minNoticeHours={config.minNoticeHours}
          counsellorId={state.counsellorId}
          date={state.date}
          slotStart={state.slotStart}
          onPickDate={(date) => patch({ date, slotStart: null, slotCounsellorId: null })}
          onPickSlot={(start, counsellorId) => patch({ slotStart: start, slotCounsellorId: counsellorId })}
        />
      )}
      {step === 2 && (
        <IntakeStep
          form={config.intakeForm}
          values={state.intake}
          onChange={(id, value) => patch({ intake: { ...state.intake, [id]: value } })}
          showErrors={showErrors}
        />
      )}
      {step === 3 && (
        <ConsentStep
          org={org}
          consents={state.consents}
          onChange={(purpose, checked) => patch({ consents: { ...state.consents, [purpose]: checked } })}
          showError={showErrors}
        />
      )}
      {step === 4 && <ConfirmStep config={config} state={state} error={submitError} />}

      {/* Footer */}
      <div className="mt-7 flex items-center gap-3 border-t border-border pt-5">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="inline-flex h-11 items-center gap-1.5 rounded-control border border-border bg-surface px-4 text-[14px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {showErrors && !canAdvance && (step === 0 || step === 1) && (
            <span className="text-[12.5px] text-danger">
              {step === 0 ? "Choose a service to continue." : "Pick a time to continue."}
            </span>
          )}
          {isConfirm ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-control px-5 text-[14px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95 disabled:opacity-70"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Confirm booking
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-control px-5 text-[14px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95",
              )}
              style={{ backgroundColor: "var(--brand)" }}
            >
              Continue
              <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </BookingShell>
  );
}
