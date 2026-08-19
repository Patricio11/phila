"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Phone } from "lucide-react";
import type { FormSnapshot, FormTheme } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { PhilaMark } from "@/components/brand/logo";
import { FormFields } from "@/components/forms/form-fields";
import { HeroPanel } from "@/components/forms/form-theme";
import { intakeErrors } from "@/components/booking/validation";
import { splitIntoSteps } from "@/lib/forms/steps";
import { submitForm } from "@/app/f/[token]/actions";

/**
 * The public form fill page (Phase 18.6). No account  the client opens their link,
 * answers, and submits. Renders through the shared FormFields (matches the hub
 * preview). When the form has a `split` theme, it shows a branded hero panel beside
 * the form (stacked on mobile). SADAG crisis line is always in reach.
 */
export function FormFillView({
  token, companyToken = null, orgName, snapshot, theme, imageUrl, counsellorFill = null,
}: {
  token: string;
  /** Batch 2t - the employer link this form was opened from, if any. */
  companyToken?: string | null;
  orgName: string;
  snapshot: FormSnapshot;
  theme?: FormTheme | null;
  imageUrl?: string | null;
  /** Batch 4p - a counsellor fills this ABOUT a client: no crisis line, "back to Phila" after. */
  counsellorFill?: { clientName: string } | null;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Batch 2l - a long form walks in steps (a `section` field is a page break).
  const [step, setStep] = useState(0);

  const steps = useMemo(() => splitIntoSteps(snapshot.fields), [snapshot.fields]);
  const multi = steps.length > 1;
  const current = steps[Math.min(step, steps.length - 1)]!;
  const isLast = step >= steps.length - 1;

  const errors = showErrors ? intakeErrors(current.fields, values) : {};
  const split = theme?.layout === "split";

  const next = () => {
    const errs = intakeErrors(current.fields, values);
    if (Object.keys(errs).length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, steps.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setShowErrors(false);
    setStep((s) => Math.max(0, s - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setError(null);
    // Validate the whole form on submit - a skipped required answer on an
    // earlier step sends the client back to it rather than failing silently.
    const errs = intakeErrors(snapshot.fields, values);
    if (Object.keys(errs).length > 0) {
      setShowErrors(true);
      const bad = steps.findIndex((st) => st.fields.some((f) => errs[f.id]));
      if (bad >= 0 && bad !== step) setStep(bad);
      return;
    }
    setSubmitting(true);
    const res = await submitForm({ token, answers: values, companyToken });
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
  };

  const formBody = done ? (
    counsellorFill ? (
      <div className="space-y-2 px-6 py-12 text-center" data-testid="counsellor-fill-done">
        <CheckCircle2 className="mx-auto size-11 text-accent" strokeWidth={1.7} aria-hidden />
        <div className="text-[16px] font-[680] text-text">Saved to {counsellorFill.clientName.split(" ")[0]}&apos;s record</div>
        <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-text-2">Your answers sit on the client&apos;s record and in the form&apos;s responses, marked as filled by you.</p>
        <a href="/app/forms" className="inline-flex h-9 items-center rounded-control bg-accent px-3 text-[13px] font-medium text-accent-ink hover:bg-accent-hover">Back to Phila</a>
      </div>
    ) : (
    <div className="space-y-2 px-6 py-12 text-center">
      <CheckCircle2 className="mx-auto size-11 text-accent" strokeWidth={1.7} aria-hidden />
      <div className="text-[16px] font-[680] text-text">Thank you  that&apos;s sent</div>
      <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-text-2">{orgName} has your answers. You can close this page  there&apos;s nothing else to do.</p>
    </div>
    )
  ) : (
    <div className="px-6 py-6 sm:px-7">
      {counsellorFill && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent" data-testid="counsellor-fill-badge">
          You&apos;re filling this in about {counsellorFill.clientName}
        </div>
      )}
      <div className="mb-4">
        <h1 className="text-[18px] font-[680] tracking-[-0.01em] text-text">{snapshot.title}</h1>
        {step === 0 && snapshot.intro && <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{snapshot.intro}</p>}
      </div>

      {multi && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-[11.5px] text-text-3">
            <span>Step {step + 1} of {steps.length}</span>
            <span className="tabular-nums">{Math.round(((step + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      )}

      {current.section && (
        <div className="mb-4">
          <h2 className="text-[15px] font-[680] text-text">{current.section.label}</h2>
          {current.section.help && <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-2">{current.section.help}</p>}
        </div>
      )}

      <FormFields fields={current.fields} values={values} errors={errors} onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))} idPrefix="fill" />
      {error && <p className="mt-3 text-[12.5px] font-medium text-danger">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        {multi && step > 0 && (
          <Button variant="ghost" onClick={back} disabled={submitting}>
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back
          </Button>
        )}
        {isLast ? (
          <Button onClick={submit} loading={submitting} className="flex-1">Submit</Button>
        ) : (
          <Button onClick={next} className="flex-1">
            Continue <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
          </Button>
        )}
      </div>
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
        {!counsellorFill && <FootLine />}
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
        {!counsellorFill && <FootLine />}
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
