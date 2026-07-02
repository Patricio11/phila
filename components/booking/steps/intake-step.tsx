"use client";

import type { IntakeForm } from "@/lib/domain/types";
import { StepHeader } from "@/components/booking/step-header";
import { FormFields } from "@/components/forms/form-fields";
import { intakeErrors, CONTACT_PAIR } from "@/components/booking/validation";

export function IntakeStep({
  form,
  values,
  onChange,
  showErrors,
}: {
  form: IntakeForm;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  showErrors: boolean;
}) {
  const errors = showErrors ? intakeErrors(form.fields, values, { contactPair: CONTACT_PAIR }) : {};

  // Phone + email are a pair: at least one is enough (many clients have no email).
  // Render both as "optional" and carry the "one is enough" meaning in a hint, so
  // the required asterisk never contradicts what actually validates.
  const isPair = (id: string) => id === CONTACT_PAIR[0] || id === CONTACT_PAIR[1];
  const fields = form.fields.map((f) => (isPair(f.id) ? { ...f, required: false } : f));
  const hasPair = form.fields.some((f) => f.id === CONTACT_PAIR[0]) && form.fields.some((f) => f.id === CONTACT_PAIR[1]);

  return (
    <div>
      <StepHeader title={form.title} subtitle={form.intro} />
      {hasPair && (
        <p className="mb-4 rounded-control border border-border bg-surface-2/40 px-3 py-2 text-[12px] text-text-2">
          Share a <strong className="font-medium text-text">phone number or an email</strong> — one is enough so we can confirm your session.
        </p>
      )}
      <FormFields fields={fields} values={values} errors={errors} onChange={onChange} idPrefix="intake" />
    </div>
  );
}
