import type { IntakeField } from "@/lib/domain/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The intake fields that together satisfy "at least one way to reach the client". */
export const CONTACT_PAIR = ["phone", "email"] as const;

/**
 * `contactPair` names two field ids (e.g. `["phone", "email"]`) that count as a
 * single "at least one" requirement  used by booking so a client with only a
 * phone number *or* only an email can still book (many SA clients have no email).
 * Each is still format-checked when filled. Omitted → every field validates on its
 * own `required` flag (the generic Forms behaviour).
 */
export function intakeErrors(
  fields: IntakeField[],
  values: Record<string, string>,
  opts?: { contactPair?: readonly [string, string] },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const pair = opts?.contactPair;
  const pairSatisfied = pair
    ? Boolean((values[pair[0]] ?? "").trim()) || Boolean((values[pair[1]] ?? "").trim())
    : true;
  const format = (f: IntakeField, v: string): string | undefined => {
    if (v && f.type === "email" && !EMAIL.test(v)) return "That email doesn't look right.";
    if (v && f.type === "tel" && v.replace(/\D/g, "").length < 9) return "That number looks too short.";
    return undefined;
  };
  for (const f of fields) {
    const v = (values[f.id] ?? "").trim();
    if (pair && (f.id === pair[0] || f.id === pair[1])) {
      const err = !pairSatisfied ? "Add a phone number or an email." : format(f, v);
      if (err) errors[f.id] = err;
      continue;
    }
    if (f.required && !v) {
      errors[f.id] = "This one's needed.";
      continue;
    }
    const err = format(f, v);
    if (err) errors[f.id] = err;
  }
  return errors;
}

export function isIntakeValid(
  fields: IntakeField[],
  values: Record<string, string>,
  opts?: { contactPair?: readonly [string, string] },
): boolean {
  return Object.keys(intakeErrors(fields, values, opts)).length === 0;
}
