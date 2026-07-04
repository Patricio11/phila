/**
 * File → { headers, rows } for the import engine. CSV is parsed with a small,
 * dependency-free state machine (quoted fields, embedded delimiters, "" escapes,
 * BOM, CRLF, comma/semicolon/tab). XLSX uses exceljs, lazy-loaded only when an
 * .xlsx is actually picked so it never bloats the main bundle. Everything runs in
 * the browser — the file never leaves the device.
 */
export interface ParsedFile {
  headers: string[];
  rows: string[][];
  fileName: string;
}

function detectDelimiter(headerLine: string): string {
  const counts = [",", ";", "\t"].map((d) => ({ d, n: headerLine.split(d).length }));
  return counts.sort((a, b) => b.n - a.n)[0]!.d;
}

/** Parse a CSV/TSV string into a grid. */
export function parseCsv(text: string, fileName = "pasted.csv"): ParsedFile {
  const clean = text.replace(/^﻿/, ""); // strip BOM
  const firstLine = clean.slice(0, clean.search(/\r?\n/) === -1 ? clean.length : clean.search(/\r?\n/));
  const delim = detectDelimiter(firstLine);

  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = ""; grid.push(row); row = [];
    } else if (c === "\r") {
      // handled by the \n branch (CRLF) or ignored (lone CR)
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); grid.push(row); }

  const nonEmpty = grid.filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  return { headers, rows, fileName };
}

/** Parse the first sheet of an .xlsx (exceljs, lazy-loaded). */
export async function parseXlsx(file: File): Promise<ParsedFile> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [], fileName: file.name };

  const cellText = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "object") {
      const o = v as { text?: string; result?: unknown; hyperlink?: string; richText?: { text: string }[] };
      if (o.richText) return o.richText.map((r) => r.text).join("");
      if (typeof o.text === "string") return o.text;
      if (o.result != null) return String(o.result);
      if (o.hyperlink) return o.hyperlink;
      return "";
    }
    return String(v);
  };

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const values = r.values as unknown[]; // 1-indexed; [0] is empty
    matrix.push(values.slice(1).map(cellText));
  });
  const nonEmpty = matrix.filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  return { headers, rows, fileName: file.name };
}

/** Dispatch by extension. */
export async function parseFile(file: File): Promise<ParsedFile> {
  if (/\.xlsx?$/i.test(file.name)) return parseXlsx(file);
  return parseCsv(await file.text(), file.name);
}
