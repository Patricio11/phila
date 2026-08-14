import type { FormNotifySettings } from "@/lib/domain/types";

/**
 * Batch 3j - the email the practice receives when someone submits a form.
 * The org edits the wording per form; these tokens fill in at send time.
 * Pure, so the rendering is unit-tested.
 */
export const NOTIFY_TOKENS = ["{name}", "{form}", "{practice}", "{date}"] as const;

export const DEFAULT_NOTIFY_SUBJECT = "New response: {form}";
export const DEFAULT_NOTIFY_BODY =
  "{name} has completed {form}.\n\nOpen Phila to read their answers: sign in and go to Forms.\n\n{practice} · {date}";

export function renderNotifyEmail(
  settings: Pick<FormNotifySettings, "subject" | "body">,
  vars: { name: string; form: string; practice: string; date: string },
): { subject: string; body: string } {
  const fill = (t: string) =>
    t
      .replaceAll("{name}", vars.name)
      .replaceAll("{form}", vars.form)
      .replaceAll("{practice}", vars.practice)
      .replaceAll("{date}", vars.date);
  return {
    subject: fill(settings.subject?.trim() || DEFAULT_NOTIFY_SUBJECT).slice(0, 200),
    body: fill(settings.body?.trim() || DEFAULT_NOTIFY_BODY).slice(0, 4000),
  };
}
