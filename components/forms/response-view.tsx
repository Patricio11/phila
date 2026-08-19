"use client";

import type { FormField } from "@/lib/domain/types";
import { docRows, type DocBrand } from "@/lib/export/response-pdf";
import { cn } from "@/lib/utils";

/**
 * Batch 2l → 4q - a completed form, read back as the SAME document the PDF
 * prints: the practice's logo, the title in the practice's colour, one bordered
 * table with Questions on the left and Answers on the right (section titles as
 * full-width rows, statements in italics), the practice's footer line. Renders
 * from the assignment's SNAPSHOT, so later edits to the form never rewrite what
 * was actually answered. Without a `brand` it is the bare table.
 */
export function ResponseView({ fields, answers, formTitle, brand, respondent, submittedAt, className }: {
  fields: FormField[];
  answers: Record<string, string>;
  formTitle?: string;
  brand?: DocBrand | null;
  respondent?: string | null;
  submittedAt?: string | null;
  className?: string;
}) {
  void respondent; void submittedAt; // shown by the dialog, not printed on the document (the example layout)
  const rows = docRows(fields, answers);
  const accent = brand?.accent && /^#[0-9a-fA-F]{6}$/.test(brand.accent) ? brand.accent : undefined;
  return (
    // A sheet of A4 on a desk: 210 x 297 proportions (it grows past one page's
    // height when the answers do), 14 mm side margins, paper-white regardless
    // of theme, on a muted backdrop.
    <div className={cn("rounded-card bg-surface-2/70 p-3 sm:p-5", className)}>
    <div
      className="mx-auto flex w-full max-w-[794px] flex-col border border-border/60 bg-white px-[7%] py-[6%] text-[#111] shadow-[0_2px_14px_rgba(0,0,0,0.10)]"
      style={{ aspectRatio: "210 / 297", height: "auto", overflow: "visible" }}
      data-testid="response-document"
    >
      {brand && (
        <div className="mb-8 flex justify-center">
          {brand.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={brand.logoUrl} alt={brand.orgName} className="max-h-14 max-w-[200px] object-contain" />
            : <div className="text-[15px] font-[700]" style={{ color: accent }}>{brand.orgName}</div>}
        </div>
      )}
      {formTitle && <h3 className="mb-4 text-center text-[18px] font-[700] leading-tight tracking-[-0.01em]" style={{ color: accent ?? "var(--color-accent)" }}>{formTitle}</h3>}
      <table className="w-full table-fixed border-collapse text-[12px] leading-relaxed" style={{ border: "1.25px solid #2a3530" }}>
        <thead>
          <tr>
            <th className="w-1/2 px-3 py-2 text-left text-[10px] font-[700] uppercase tracking-[0.08em] text-white" style={{ background: accent ?? "var(--color-accent)" }}>Questions:</th>
            <th className="w-1/2 px-3 py-2 text-left text-[10px] font-[700] uppercase tracking-[0.08em] text-white" style={{ background: accent ?? "var(--color-accent)" }}>Answers:</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            r.kind === "section" ? (
              <tr key={i}><td colSpan={2} className="border border-[#59635d] px-3 py-2 text-[10.5px] font-[700] uppercase tracking-[0.07em]" style={{ color: accent ?? "var(--color-accent)", background: `${accent ?? "#1f6f4a"}14`, borderLeft: `3px solid ${accent ?? "var(--color-accent)"}` }}>{r.label}</td></tr>
            ) : r.kind === "statement" ? (
              <tr key={i}><td colSpan={2} className="whitespace-pre-wrap border border-[#59635d] bg-[#fcfcfb] px-3 py-2 italic text-[#4a534e]">{r.label}</td></tr>
            ) : (
              <tr key={i}>
                <td className="break-words border border-[#59635d] bg-[#fafbfa] px-3 py-2 font-[600] text-[#222c26]">{r.label}</td>
                <td className={cn("whitespace-pre-wrap break-words border border-[#59635d] px-3 py-2", r.answered ? "text-[#16201b]" : "text-[#a2aba5]")}>{r.answered ? r.answer : "-"}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {brand && <div className="mt-auto pt-6 text-center text-[10.5px] text-[#6b7570]">{(brand.footer ?? "").trim() || `${brand.orgName} · Kept confidential under POPIA`}</div>}
    </div>
    </div>
  );
}

/** Total of every numeric scale answer - e.g. the K10 score. Null when none. */
export function scaleTotal(fields: FormField[], answers: Record<string, string>): { total: number; count: number } | null {
  const scales = fields.filter((f) => f.type === "scale");
  if (scales.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const f of scales) {
    const n = Number(answers[f.id]);
    if (Number.isFinite(n) && n > 0) { total += n; count += 1; }
  }
  return count > 0 ? { total, count } : null;
}
