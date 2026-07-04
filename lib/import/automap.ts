import type { ImportField } from "@/lib/import/schema";
import type { ParsedFile } from "@/lib/import/parse";

/**
 * The "smart" part: map each field to a file column. First by header pattern, then
 * by DATA SHAPE — a column that's mostly emails maps to email even if its header is
 * "Contact". One field ↔ one column (a match steals the column from any other field).
 */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function columnCells(parsed: ParsedFile, col: number, sample = 40): string[] {
  return parsed.rows.slice(0, sample).map((r) => (r[col] ?? "").trim()).filter(Boolean);
}

function shapeScore(cells: string[], field: ImportField): number {
  if (cells.length === 0) return 0;
  const digits = (c: string) => c.replace(/\D/g, "").length;
  const ok = cells.filter((c) => {
    switch (field.kind) {
      case "email": return EMAIL_RE.test(c);
      case "phone": return !EMAIL_RE.test(c) && digits(c) >= 7 && digits(c) <= 15;
      case "enum": {
        const l = c.toLowerCase();
        return Boolean(field.enumValues?.some((v) => v.toLowerCase() === l) || field.aliases?.[l]);
      }
      case "text": return /[a-z]/i.test(c) && !EMAIL_RE.test(c) && digits(c) < 7;
    }
  }).length;
  return ok / cells.length;
}

/**
 * Score a (field, column) pairing. We weight DATA SHAPE more than the header, because
 * headers lie ("Contact" over a column of emails) but the data doesn't — so a column
 * that's clearly emails wins the email field even if a phone-ish header sits above it.
 * A header-only signal (score 1) still suffices when the column has no usable samples.
 */
function pairScore(field: ImportField, header: string, cells: string[]): number {
  const headerHit = header && field.match.test(header) ? 1 : 0;
  const shape = shapeScore(cells, field);
  return shape * 2 + headerHit;
}

export function autoMap(fields: ImportField[], parsed: ParsedFile): Record<string, number | null> {
  const mapping: Record<string, number | null> = {};
  for (const f of fields) mapping[f.key] = null;

  // Score every field × column pairing, then assign greedily from the strongest
  // signal down — one field ↔ one column. A confident data-shape match therefore
  // steals a column back from a weaker header match on a different field.
  const cols = parsed.headers.map((_, i) => columnCells(parsed, i));
  const candidates: { field: string; col: number; score: number }[] = [];
  for (const f of fields) {
    for (let i = 0; i < parsed.headers.length; i++) {
      const score = pairScore(f, parsed.headers[i] ?? "", cols[i] ?? []);
      if (score > 0) candidates.push({ field: f.key, col: i, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const MIN_SCORE = 0.5; // need a real header hit or a decent data-shape match
  const usedCols = new Set<number>();
  const usedFields = new Set<string>();
  for (const c of candidates) {
    if (c.score < MIN_SCORE) break;
    if (usedCols.has(c.col) || usedFields.has(c.field)) continue;
    mapping[c.field] = c.col;
    usedCols.add(c.col);
    usedFields.add(c.field);
  }

  return mapping;
}
