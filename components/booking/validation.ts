import type { IntakeField } from "@/lib/mock/types";
import type { BookingState } from "@/components/booking/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns a map of fieldId → error for any required-but-empty or malformed field. */
export function intakeErrors(
  fields: IntakeField[],
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.id] ?? "").trim();
    if (f.required && !v) {
      errors[f.id] = "This one's needed.";
      continue;
    }
    if (v && f.type === "email" && !EMAIL.test(v)) errors[f.id] = "That email doesn't look right.";
    if (v && f.type === "tel" && v.replace(/\D/g, "").length < 9)
      errors[f.id] = "That number looks too short.";
  }
  return errors;
}

export function isIntakeValid(fields: IntakeField[], values: Record<string, string>): boolean {
  return Object.keys(intakeErrors(fields, values)).length === 0;
}

/** Booking + clinical-notes consent are the lawful basis to proceed. */
export function hasRequiredConsents(consents: BookingState["consents"]): boolean {
  return Boolean(consents.booking) && Boolean(consents.notes);
}
