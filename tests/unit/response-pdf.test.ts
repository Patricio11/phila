import { describe, expect, it } from "vitest";
import { buildResponsePdfHtml, docRows } from "@/lib/export/response-pdf";
import { composeDocumentFooter, effectiveDocumentFooter } from "@/lib/forms/doc-footer";
import type { FormField } from "@/lib/domain/types";

const FIELDS: FormField[] = [
  { id: "s1", label: "About you", type: "section", required: false },
  { id: "name", label: "Your full name", type: "text", required: true },
  { id: "notes", label: "Anything else?", type: "textarea", required: false },
  { id: "st", label: "Please read our terms.", type: "statement", required: false },
  { id: "mood", label: "Mood", type: "scale", required: false, scale: { min: 1, max: 5 } } as FormField,
];

describe("buildResponsePdfHtml (batch 3w → 4q document layout)", () => {
  it("prints a Questions | Answers table: sections as full rows, statements in italics, answers beside their questions", () => {
    const html = buildResponsePdfHtml({
      formTitle: "Intake",
      respondent: "Lerato Mahlangu",
      submittedAt: "2026-08-14T10:00:00Z",
      fields: FIELDS,
      answers: { name: "Lerato Mahlangu", notes: "line one\nline two", mood: "4" },
    });
    expect(html).toContain("<th style=\"width:50%\">Questions:</th><th style=\"width:50%\">Answers:</th>");
    expect(html).toContain('<tr class="section"><td colspan="2">About you</td></tr>');
    expect(html).toContain('<td class="q">Your full name</td><td class="a">Lerato Mahlangu</td>');
    expect(html).toContain("line one<br>line two");
    expect(html).toContain('<tr class="statement"><td colspan="2">Please read our terms.</td></tr>');
    expect(html).toContain('<td class="a">4 / 5</td>');
    expect(html).not.toContain("Answered by"); // the example layout carries no meta line
    expect(html).toContain("text-align: center");
    expect(html).not.toContain('class="rule"');
    // header/footer repeat per page
    expect(html).toContain('class="page-head"');
    expect(html).toContain('class="page-foot"');
    // spacer rows reserve the room on every page; fixed elements pin to the page edges
    expect(html).toContain("table.frame > thead { display: table-header-group; }");
    expect(html).toContain("table.frame > tfoot { display: table-footer-group; }");
    expect(html).toContain(".page-foot { position: fixed; bottom: 0;");
  });

  it("marks unanswered questions with a quiet dash", () => {
    const html = buildResponsePdfHtml({ formTitle: "Intake", fields: FIELDS, answers: {} });
    expect(html).toContain('<td class="a empty">-</td>');
  });

  it("wears the practice's brand: logo on every page, accent title, footer line", () => {
    const html = buildResponsePdfHtml({
      formTitle: "Intake 2026", fields: FIELDS, answers: {},
      brand: { orgName: "The Counselling Hub", logoUrl: "https://x/logo.png", accent: "#9b1c1c", footer: "174-733 NPO | 145 Sir Lowry Road, Woodstock 7925 | info@counsellinghub.org.za" },
    });
    expect(html).toContain('<div class="page-head"><img src="https://x/logo.png" alt="The Counselling Hub"></div>');
    expect(html).toContain('<div class="page-foot"><div class="line">174-733 NPO | 145 Sir Lowry Road, Woodstock 7925 | info@counsellinghub.org.za</div></div>');
    expect(html).toContain("color: #9b1c1c");
  });

  it("falls back to the practice name when there is no logo, and a calm footer when none is set", () => {
    const html = buildResponsePdfHtml({ formTitle: "Intake", fields: FIELDS, answers: {}, brand: { orgName: "Masizakhe", logoUrl: null, accent: "bad", footer: null } });
    expect(html).toContain('<div class="orgname">Masizakhe</div>');
    expect(html).toContain('Masizakhe · Kept confidential under POPIA');
    expect(html).toContain("color: #1f6f4a"); // invalid accent → default
  });

  it("escapes HTML in titles, questions, answers and the footer", () => {
    const html = buildResponsePdfHtml({
      formTitle: "<script>x</script>",
      fields: [{ id: "q", label: "A <b>question</b>", type: "text", required: false }],
      answers: { q: "<img onerror=alert(1)>" },
      brand: { orgName: "O", logoUrl: null, accent: null, footer: "<i>f</i>" },
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &lt;b&gt;question&lt;/b&gt;");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(html).toContain("&lt;i&gt;f&lt;/i&gt;");
  });

  it("docRows keeps the order and flattens checkbox lists", () => {
    const rows = docRows([{ id: "c", label: "Pick", type: "checkbox", required: false, options: ["A", "B"] } as FormField], { c: "A; B" });
    expect(rows).toEqual([{ kind: "qa", label: "Pick", answer: "A, B", answered: true }]);
  });
});

describe("document footer", () => {
  it("composes NPO | address | email from the profile", () => {
    expect(composeDocumentFooter({ registrationNo: "174-733", address: "145 Sir Lowry Road\nWoodstock 7925", email: "info@counsellinghub.org.za" }))
      .toBe("174-733 NPO | 145 Sir Lowry Road, Woodstock 7925 | info@counsellinghub.org.za");
    expect(composeDocumentFooter({ registrationNo: "2019/123456/08 NPC", phone: "021 000 0000" })).toBe("2019/123456/08 NPC | 021 000 0000");
    expect(composeDocumentFooter({}, "Masizakhe")).toBe("Masizakhe");
  });
  it("form footer beats the practice footer beats the composed one", () => {
    expect(effectiveDocumentFooter(" form ", "org", "composed")).toBe("form");
    expect(effectiveDocumentFooter("", "org", "composed")).toBe("org");
    expect(effectiveDocumentFooter(null, null, "composed")).toBe("composed");
  });
});

describe("batch 4r - filed session notes", () => {
  it("formReference: initials + session date + stable suffix", async () => {
    const { formReference, filedResponseName } = await import("@/lib/forms/reference");
    expect(formReference("Session Note", "2026-08-06T12:00:00Z", "fa_b5c1386c-0e5")).toMatch(/^SN-20260806-[A-Z0-9]{6}$/);
    expect(formReference("After your session", "2026-08-06T23:30:00Z", "x")).toMatch(/^AY-20260807-/); // SAST rolls the date
    expect(formReference("K10", "bad-date", "abc")).toMatch(/^K1-00000000-/);
    const name = filedResponseName("Session Note", "SN-20260806-ABC123", "Johan Botha", "2026-08-06T12:00:00Z");
    expect(name).toMatch(/^Session Note SN-20260806-ABC123 - Johan Botha - 0?6 Aug 2026\.pdf$/);
  });

  it("buildResponsePdfBytes produces a real multi-page PDF", async () => {
    const { buildResponsePdfBytes } = await import("@/lib/export/response-pdf-server");
    const fields = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, label: `${i + 1}. In the past 4 weeks, about how often did you feel tired for no good reason?`, type: "text", required: false })) as import("@/lib/domain/types").FormField[];
    const answers = Object.fromEntries(fields.map((f) => [f.id, "Some of the time - though it varies week to week."]));
    const bytes = await buildResponsePdfBytes({
      formTitle: "Session Note", fields, answers, reference: "SN-20260806-ABC123",
      brand: { orgName: "Masizakhe Counselling", logoUrl: null, accent: "#1C7D58", footer: "174-733 NPO | Soweto | hello@masizakhe.org.za" },
    });
    expect(bytes.length).toBeGreaterThan(4000);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThan(1); // 40 rows must paginate
  });
});
