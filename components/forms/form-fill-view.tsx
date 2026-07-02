"use client";

import { useState } from "react";
import { CheckCircle2, Phone } from "lucide-react";
import type { FormSnapshot, FormTheme } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { PhilaMark } from "@/components/brand/logo";
import { FormFields } from "@/components/forms/form-fields";
import { HeroPanel } from "@/components/forms/form-theme";
import { intakeErrors } from "@/components/booking/validation";
import { submitForm } from "@/app/f/[token]/actions";

/**
 * The public form fill page (Phase 18.6). No account  the client opens their link,
 * answers, and submits. Renders through the shared FormFields (matches the hub
 * preview). When the form has a `split` theme, it shows a branded hero panel beside
 * the form (stacked on mobile). SADAG crisis line is always in reach.
 */
export function FormFillView({
  token, orgName, snapshot, theme, imageUrl,
}: {
  token: string;
  orgName: string;
  snapshot: FormSnapshot;
  theme?: FormTheme | null;
  imageUrl?: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = showErrors ? intakeErrors(snapshot.fields, values) : {};
  const split = theme?.layout === "split";

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

  const formBody = done ? (
    <div className="space-y-2 px-6 py-12 text-center">
      <CheckCircle2 className="mx-auto size-11 text-accent" strokeWidth={1.7} aria-hidden />
      <div className="text-[16px] font-[680] text-text">Thank you  that&apos;s sent</div>
      <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-text-2">{orgName} has your answers. You can close this page  there&apos;s nothing else to do.</p>
    </div>
  ) : (
    <div className="px-6 py-6 sm:px-7">
      <div className="mb-4">
        <h1 className="text-[18px] font-[680] tracking-[-0.01em] text-text">{snapshot.title}</h1>
        {snapshot.intro && <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{snapshot.intro}</p>}
      </div>
      <FormFields fields={snapshot.fields} values={values} errors={errors} onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))} idPrefix="fill" />
      {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}
      <Button onClick={submit} loading={submitting} className="mt-6 w-full">Submit</Button>
      <p className="mt-3 text-center text-[11px] text-text-3">Your answers are kept confidential under POPIA.</p>
    </div>
  );

  if (split && theme) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-4 py-8">
        <div className="w-full max-w-4xl overflow-hidden rounded-card border border-border bg-surface shadow-e2">
          <div className="grid lg:grid-cols-2">
            <HeroPanel theme={theme} orgName={orgName} imageUrl={imageUrl} />
            <div className="flex flex-col justify-center">{formBody}</div>
          </div>
        </div>
        <FootLine />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-center justify-center gap-2 text-text-2">
          <PhilaMark size={28} />
          <span className="text-[15px] font-[680] tracking-[-0.01em] text-text">Phila</span>
        </div>
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-e2">
          {!done && (
            <div className="border-b border-border px-6 pt-5 text-[12px] text-text-3">{orgName}</div>
          )}
          {formBody}
        </div>
        <FootLine />
      </div>
    </main>
  );
}

function FootLine() {
  return (
    <div className="mx-auto mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-text-3">
      <Phone className="size-3.5 text-accent" strokeWidth={2} aria-hidden />
      Need to talk now? SADAG <span className="font-semibold text-text-2">0800 567 567</span>  free, any time.
    </div>
  );
}
