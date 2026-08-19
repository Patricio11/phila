import type { FormField } from "@/lib/domain/types";
import { isAnswerable } from "@/lib/domain/types";

/**
 * Batch 3w → 4q - a completed form as the practice's own A4 document.
 *
 * The layout every practice asked for (the "Form Publisher" look): the
 * practice's logo centred at the top of EVERY page, the form title in the
 * practice's accent colour, then one bordered table - **Questions** on the
 * left, **Answers** on the right, a row per question, section titles as
 * full-width rows - and a one-line practice footer (NPO number · address ·
 * email) at the foot of EVERY page. Same zero-dependency pattern as the
 * table exports: print-styled HTML, the OS print dialog saves it as PDF.
 *
 * The builder is pure (unit-tested): escaping, row logic, header / footer
 * repetition. The on-screen `ResponseView` renders the same table so what a
 * counsellor or admin sees is what the export prints.
 */

/** The practice's document identity - logo, accent, footer line. */
export interface DocBrand {
  orgName: string;
  /** A short-lived signed URL for the logo; null = no logo (the name prints instead). */
  logoUrl: string | null;
  /** Hex accent for the title (the practice's brand colour). */
  accent: string | null;
  /** The footer line printed on every page; null = a calm default. */
  footer: string | null;
}

export interface ResponsePdfInput {
  formTitle: string;
  /** The practice's name - printed under the title when no brand is given. */
  orgName?: string | null;
  /** Who answered, when known. */
  respondent?: string | null;
  submittedAt?: string | null;
  fields: FormField[];
  answers: Record<string, string>;
  /** Batch 4q - the practice's document identity (logo / accent / footer). */
  brand?: DocBrand | null;
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One printed row: a section title, a statement, or a question + answer. Pure, shared with the screen view. */
export type DocRow =
  | { kind: "section"; label: string }
  | { kind: "statement"; label: string }
  | { kind: "qa"; label: string; answer: string; answered: boolean };

export function docRows(fields: FormField[], answers: Record<string, string>): DocRow[] {
  const out: DocRow[] = [];
  for (const f of fields) {
    if (f.type === "section") { out.push({ kind: "section", label: f.label || "" }); continue; }
    if (f.type === "statement") { out.push({ kind: "statement", label: f.label || "" }); continue; }
    if (!isAnswerable(f.type)) continue;
    const raw = (answers[f.id] ?? "").trim();
    let answer = raw;
    if (raw && f.type === "scale") answer = `${raw} / ${f.scale?.max ?? 5}`;
    if (raw && f.type === "acknowledge") answer = "Acknowledged";
    if (raw && f.type === "checkbox") answer = raw.split(/\s*[;,|]\s*|\n/).map((v) => v.trim()).filter(Boolean).join(", ");
    out.push({ kind: "qa", label: f.label || "Untitled question", answer, answered: raw.length > 0 });
  }
  return out;
}

/** The complete printable document, as HTML. Pure - no window access. */
export function buildResponsePdfHtml(input: ResponsePdfInput): string {
  const brand = input.brand ?? null;
  const orgName = brand?.orgName ?? input.orgName ?? "";
  const accent = brand?.accent && /^#[0-9a-fA-F]{6}$/.test(brand.accent) ? brand.accent : "#1f6f4a";
  const footer = (brand?.footer ?? "").trim() || [orgName, "Kept confidential under POPIA"].filter(Boolean).join(" · ");

  const rows = docRows(input.fields, input.answers)
    .map((r) => {
      if (r.kind === "section") return `<tr class="section"><td colspan="2">${esc(r.label)}</td></tr>`;
      if (r.kind === "statement") return `<tr class="statement"><td colspan="2">${esc(r.label).replace(/\n/g, "<br>")}</td></tr>`;
      return `<tr><td class="q">${esc(r.label)}</td><td class="a${r.answered ? "" : " empty"}">${r.answered ? esc(r.answer).replace(/\n/g, "<br>") : "-"}</td></tr>`;
    })
    .join("\n");

  const head = brand?.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(orgName)}">`
    : `<div class="orgname">${esc(orgName)}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(input.formTitle)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 8mm 14mm; }
  html, body { margin: 0; padding: 0; }
  body { font: 11.5px/1.55 "Segoe UI", Arial, Helvetica, system-ui, sans-serif; color: #16201b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* A REAL page header and footer on every printed page: the frame table's
     thead / tfoot spacer rows reserve the space at the top and bottom of each
     page, and the fixed elements draw the logo / footer line into it - pinned
     to the page edges, exactly like a letterhead. */
  .page-head { position: fixed; top: 0; left: 0; right: 0; height: 24mm; text-align: center; }
  .page-head img { max-height: 17mm; max-width: 62mm; object-fit: contain; margin-top: 2.5mm; }
  .page-head .orgname { font-size: 17px; font-weight: 700; letter-spacing: .01em; color: ${accent}; padding-top: 8mm; }
  .page-foot { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; text-align: center; font-size: 9.5px; letter-spacing: .02em; color: #7b847e; }
  .page-foot .line { border-top: 1.5px solid ${accent}22; padding-top: 2.5mm; }
  table.frame { width: 100%; border-collapse: collapse; }
  table.frame > thead { display: table-header-group; }
  table.frame > tfoot { display: table-footer-group; }
  td.head-space { height: 44mm; border: 0; padding: 0; }
  td.foot-space { height: 13mm; border: 0; padding: 0; }
  /* The example layout: the title centred, clear air between it and the logo. */
  h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: ${accent}; margin: 0 0 14px; text-align: center; }
  table.qa { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.25px solid #2a3530; }
  table.qa > thead { display: table-header-group; }
  table.qa th, table.qa td { border: 0.75px solid #59635d; vertical-align: top; padding: 10px 12px; font-size: 11px; line-height: 1.5; word-wrap: break-word; }
  table.qa th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #ffffff; background: ${accent}; border-color: ${accent}; }
  td.q { font-weight: 600; color: #222c26; background: #fafbfa; }
  td.a { color: #16201b; }
  td.a.empty { color: #a2aba5; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  tr.section td { font-weight: 700; font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: ${accent}; background: ${accent}14; border-left: 3px solid ${accent}; }
  tr.statement td { font-style: italic; color: #4a534e; background: #fcfcfb; }
</style></head><body>
<div class="page-head">${head}</div>
<div class="page-foot"><div class="line">${esc(footer)}</div></div>
<table class="frame">
<thead><tr><td class="head-space"></td></tr></thead>
<tfoot><tr><td class="foot-space"></td></tr></tfoot>
<tbody><tr><td style="border:0;padding:0">
<h1>${esc(input.formTitle)}</h1>
<table class="qa">
<thead><tr><th style="width:50%">Questions:</th><th style="width:50%">Answers:</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</td></tr></tbody>
</table>
<script>window.onload = () => { setTimeout(() => window.print(), 150); };</script>
</body></html>`;
}

/** Open the document in a print window - the browser's dialog saves it as PDF. */
export function downloadResponsePdf(input: ResponsePdfInput): void {
  const url = URL.createObjectURL(new Blob([buildResponsePdfHtml(input)], { type: "text/html" }));
  window.open(url, "_blank", "width=900,height=700");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
