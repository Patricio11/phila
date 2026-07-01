"use client";

import type { FormField } from "@/lib/domain/types";
import { FieldError, FieldHint, Input, Label, RadioGroup, Textarea } from "@/components/ui/input";

/**
 * The one renderer for a form's fields  used by the booking intake step, the hub
 * preview, and the client fill page. `readOnly` renders the exact client view
 * without accepting input (a preview); interactive mode takes values + onChange.
 * Because all three surfaces render through here, "preview == what the client
 * sees" is structural, not duplicated.
 */
export function FormFields({
  fields,
  values,
  errors,
  onChange,
  readOnly = false,
  idPrefix = "ff",
}: {
  fields: FormField[];
  values?: Record<string, string>;
  errors?: Record<string, string>;
  onChange?: (id: string, value: string) => void;
  readOnly?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const value = values?.[field.id] ?? "";
        const error = errors?.[field.id];
        const id = `${idPrefix}-${field.id}`;
        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={id} required={field.required} optional={!field.required}>
              {field.label}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={id}
                readOnly={readOnly}
                value={readOnly ? undefined : value}
                placeholder={field.placeholder}
                invalid={Boolean(error)}
                onChange={onChange ? (e) => onChange(field.id, e.target.value) : undefined}
              />
            ) : field.type === "radio" ? (
              <RadioGroup
                options={field.options ?? []}
                value={value}
                readOnly={readOnly}
                invalid={Boolean(error)}
                onChange={(v) => onChange?.(field.id, v)}
              />
            ) : (
              <Input
                id={id}
                readOnly={readOnly}
                type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : "text"}
                inputMode={field.type === "tel" ? "tel" : undefined}
                value={readOnly ? undefined : value}
                placeholder={field.placeholder}
                invalid={Boolean(error)}
                onChange={onChange ? (e) => onChange(field.id, e.target.value) : undefined}
              />
            )}

            {error ? <FieldError>{error}</FieldError> : field.help ? <FieldHint>{field.help}</FieldHint> : null}
          </div>
        );
      })}
    </div>
  );
}
