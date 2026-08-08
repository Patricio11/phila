import type { FormField } from "@/lib/domain/types";

/**
 * Batch 2l - long forms become multi-step. A `section` field is a page break:
 * everything after it (until the next section) is one step, and the section's
 * own label/help becomes that step's heading. Fields before the first section
 * form step 1 - so a form with no sections is simply a single step and nothing
 * about the old behaviour changes.
 */
export interface FormStep {
  /** The section block that opened this step (null for an implicit first step). */
  section: FormField | null;
  fields: FormField[];
}

export function splitIntoSteps(fields: FormField[]): FormStep[] {
  const steps: FormStep[] = [];
  let current: FormStep = { section: null, fields: [] };
  for (const f of fields) {
    if (f.type === "section") {
      if (current.fields.length > 0 || current.section) steps.push(current);
      current = { section: f, fields: [] };
      continue;
    }
    current.fields.push(f);
  }
  if (current.fields.length > 0 || current.section) steps.push(current);
  return steps.length > 0 ? steps : [{ section: null, fields: [] }];
}

/** A short label per step for the progress rail. */
export function stepLabel(step: FormStep, index: number): string {
  return step.section?.label?.trim() || `Step ${index + 1}`;
}
