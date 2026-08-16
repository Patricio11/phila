import { describe, expect, it } from "vitest";
import { buildResponsePdfHtml } from "@/lib/export/response-pdf";
import type { FormField } from "@/lib/domain/types";

const FIELDS: FormField[] = [
  { id: "s1", label: "About you", type: "section", required: false },
  { id: "name", label: "Your full name", type: "text", required: true },
  { id: "notes", label: "Anything else?", type: "textarea", required: false },
  { id: "st", label: "Please read our terms.", type: "statement", required: false },
];

describe("buildResponsePdfHtml (batch 3w)", () => {
  it("renders sections as headers and answers under their questions", () => {
    const html = buildResponsePdfHtml({
      formTitle: "Intake",
      respondent: "Lerato Mahlangu",
      submittedAt: "2026-08-14T10:00:00Z",
      fields: FIELDS,
      answers: { name: "Lerato Mahlangu", notes: "line one\nline two" },
    });
    expect(html).toContain("<h2>About you</h2>");
    expect(html).toContain("Your full name");
    expect(html).toContain("Lerato Mahlangu");
    expect(html).toContain("line one<br>line two");
    expect(html).toContain("Answered by Lerato Mahlangu");
    expect(html).not.toContain("Please read our terms."); // statements never print
  });

  it("marks unanswered questions with a quiet dash", () => {
    const html = buildResponsePdfHtml({ formTitle: "Intake", fields: FIELDS, answers: {} });
    expect(html).toContain('class="a empty">-</div>');
  });

  it("escapes HTML in titles, questions and answers", () => {
    const html = buildResponsePdfHtml({
      formTitle: "<script>x</script>",
      fields: [{ id: "q", label: "A <b>question</b>", type: "text", required: false }],
      answers: { q: "<img onerror=alert(1)>" },
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &lt;b&gt;question&lt;/b&gt;");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
  });
});
