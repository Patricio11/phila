"use client";

import { useState } from "react";
import { CheckCircle2, Phone, Sprout } from "lucide-react";
import type { FormSnapshot } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { FormFields } from "@/components/forms/form-fields";
import { intakeErrors } from "@/components/booking/validation";
import { submitForm } from "@/app/f/[token]/actions";

/**
 * The public form fill page (Phase 18.6). No account  the client opens their link,
 * answers, and submits. Renders through the shared FormFields, so it matches the
 * hub preview exactly. A calm confirmation on success; SADAG crisis line always in
 * reach (this is wellbeing context).
 */
export function FormFillView({ token, orgName, snapshot }: { token: string; orgName: string; snapshot: FormSnapshot }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = showErrors ? intakeErrors(snapshot.fields, values) : {};

  const submit = async () => {
    setError(null);
    const errs = intakeErrors(snapshot.fields, values);
    if (Object.keys(errs).length > 0) { setShowErrors(true); return; }
    setSubmitting(true);
    const res = await submitForm({ token, answers: values });
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-center justify-center gap-2 text-text-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white"><Sprout className="size-4" strokeWidth={2} aria-hidden /></span>
          <span className="text-[15px] font-[680] tracking-[-0.01em] text-text">Phila</span>
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-e2">
          {done ? (
            <div className="space-y-2 px-6 py-12 text-center">
              <CheckCircle2 className="mx-auto size-11 text-accent" strokeWidth={1.7} aria-hidden />
              <div className="text-[16px] font-[680] text-text">Thank you  that&apos;s sent</div>
              <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-text-2">{orgName} has your answers. You can close this page  there&apos;s nothing else to do.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-5">
                <div className="text-[12px] text-text-3">{orgName}</div>
                <h1 className="mt-1 text-[19px] font-[680] tracking-[-0.01em] text-text">{snapshot.title}</h1>
                {snapshot.intro && <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{snapshot.intro}</p>}
              </div>

              <div className="px-6 py-5">
                <FormFields fields={snapshot.fields} values={values} errors={errors} onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))} idPrefix="fill" />
                {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}
                <Button onClick={submit} loading={submitting} className="mt-6 w-full">Submit</Button>
                <p className="mt-3 text-center text-[11px] text-text-3">Your answers are kept confidential under POPIA.</p>
              </div>
            </>
          )}
        </div>

        <div className="mx-auto mt-4 flex max-w-lg items-center justify-center gap-1.5 text-[11.5px] text-text-3">
          <Phone className="size-3.5 text-accent" strokeWidth={2} aria-hidden />
          Need to talk now? SADAG <span className="font-semibold text-text-2">0800 567 567</span>  free, any time.
        </div>
      </div>
    </main>
  );
}
