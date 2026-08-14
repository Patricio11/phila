import { describe, it, expect } from "vitest";
import { renderNotifyEmail, DEFAULT_NOTIFY_SUBJECT, DEFAULT_NOTIFY_BODY } from "@/lib/forms/notify-email";

/** Batch 3j - the submission email the org writes itself, tokens filled at send. */
describe("form submission email", () => {
  const vars = { name: "Lerato Mahlangu", form: "A few details before we meet", practice: "Masizakhe Counselling", date: "14 August 2026, 09:12" };

  it("fills every token in a custom subject and body", () => {
    const out = renderNotifyEmail(
      { subject: "{form}: new answer from {name}", body: "Dear team,\n{name} submitted {form} on {date}.\n- {practice}" },
      vars,
    );
    expect(out.subject).toBe("A few details before we meet: new answer from Lerato Mahlangu");
    expect(out.body).toContain("Lerato Mahlangu submitted A few details before we meet on 14 August 2026, 09:12.");
    expect(out.body).toContain("- Masizakhe Counselling");
  });

  it("falls back to the defaults when the org saved blanks", () => {
    const out = renderNotifyEmail({ subject: "  ", body: "" }, vars);
    expect(out.subject).toBe(DEFAULT_NOTIFY_SUBJECT.replace("{form}", vars.form));
    expect(out.body).toBe(
      DEFAULT_NOTIFY_BODY.replaceAll("{name}", vars.name).replaceAll("{form}", vars.form).replaceAll("{practice}", vars.practice).replaceAll("{date}", vars.date),
    );
  });

  it("repeats a token as many times as it appears, and caps length", () => {
    const out = renderNotifyEmail({ subject: "{name} {name}", body: "x".repeat(5000) }, vars);
    expect(out.subject).toBe("Lerato Mahlangu Lerato Mahlangu");
    expect(out.body.length).toBe(4000);
  });
});
