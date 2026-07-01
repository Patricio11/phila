"use client";

import type { IntakeForm } from "@/lib/domain/types";
import { StepHeader } from "@/components/booking/step-header";
import { FormFields } from "@/components/forms/form-fields";
import { intakeErrors } from "@/components/booking/validation";

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
  const errors = showErrors ? intakeErrors(form.fields, values) : {};

  return (
    <div>
      <StepHeader title={form.title} subtitle={form.intro} />
      <FormFields fields={form.fields} values={values} errors={errors} onChange={onChange} idPrefix="intake" />
    </div>
  );
}
