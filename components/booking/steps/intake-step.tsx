"use client";

import type { IntakeForm } from "@/lib/mock/types";
import { StepHeader } from "@/components/booking/step-header";
import { FieldError, FieldHint, Input, Label, RadioGroup, Textarea } from "@/components/ui/input";
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

      <div className="space-y-5">
        {form.fields.map((field) => {
          const value = values[field.id] ?? "";
          const error = errors[field.id];
          const id = `intake-${field.id}`;
          return (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={id} required={field.required} optional={!field.required}>
                {field.label}
              </Label>

              {field.type === "textarea" ? (
                <Textarea
                  id={id}
                  value={value}
                  placeholder={field.placeholder}
                  invalid={Boolean(error)}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
              ) : field.type === "radio" ? (
                <RadioGroup
                  options={field.options ?? []}
                  value={value}
                  invalid={Boolean(error)}
                  onChange={(v) => onChange(field.id, v)}
                />
              ) : (
                <Input
                  id={id}
                  type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : "text"}
                  inputMode={field.type === "tel" ? "tel" : undefined}
                  value={value}
                  placeholder={field.placeholder}
                  invalid={Boolean(error)}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
              )}

              {error ? <FieldError>{error}</FieldError> : field.help ? <FieldHint>{field.help}</FieldHint> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
