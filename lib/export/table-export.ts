/**
 * Feedback #9 - client-side table exports. Three formats, zero dependencies:
 * CSV (UTF-8 BOM so Excel reads accents), Excel (SpreadsheetML 2003 - opens
 * natively in Excel/LibreOffice), and PDF (a print-styled window → the OS
 * "Save as PDF"). Exports are audited server-side by the caller.
 */

export interface ExportTable {
  /** Base filename, no extension - e.g. "clients-masizakhe". */
  filenameBase: string;
  /** Document title (PDF header + Excel sheet name). */
  title: string;
  /** Small line under the PDF title - org name · date · count. */
  subtitle?: string;
  headers: string[];
  rows: string[][];
}

function download(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportCsv(t: ExportTable): void {
  const lines = [t.headers.map(csvCell).join(","), ...t.rows.map((r) => r.map(csvCell).join(","))];
  download(`${t.filenameBase}.csv`, "text/csv;charset=utf-8", `﻿${lines.join("\r\n")}`);
}

const xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** SpreadsheetML 2003 - a real Excel file format, no library needed. */
export function exportExcel(t: ExportTable): void {
  const row = (cells: string[], bold = false) =>
    `<Row>${cells.map((c) => `<Cell${bold ? ' ss:StyleID="head"' : ""}><Data ss:Type="String">${xml(c)}</Data></Cell>`).join("")}</Row>`;
  const content = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="head"><Font ss:Bold="1"/></Style></Styles>
 <Worksheet ss:Name="${xml(t.title.slice(0, 30))}">
  <Table>
   ${row(t.headers, true)}
   ${t.rows.map((r) => row(r)).join("\n   ")}
  </Table>
 </Worksheet>
</Workbook>`;
  download(`${t.filenameBase}.xls`, "application/vnd.ms-excel", content);
}

/** A print-styled window - the browser's print dialog saves it as PDF. */
export function exportPdf(t: ExportTable): void {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${xml(t.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1f1c; margin: 28px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #6b7570; font-size: 11.5px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #6b7570; border-bottom: 1.5px solid #d8ded9; padding: 6px 8px; }
  td { border-bottom: 1px solid #e7ece8; padding: 6px 8px; }
  tr { page-break-inside: avoid; }
  @page { margin: 14mm; }
</style></head><body>
<h1>${xml(t.title)}</h1>
${t.subtitle ? `<div class="sub">${xml(t.subtitle)}</div>` : ""}
<table><thead><tr>${t.headers.map((h) => `<th>${xml(h)}</th>`).join("")}</tr></thead>
<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${xml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "width=900,height=700");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
