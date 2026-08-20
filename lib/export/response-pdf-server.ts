import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from "pdf-lib";
import type { FormField } from "@/lib/domain/types";
import { docRows, type DocBrand } from "@/lib/export/response-pdf";

/**
 * Batch 4r - the SAME letterhead document the browser prints (4q), built as real
 * PDF bytes on the server, so a counsellor-filled form (the session note) can be
 * FILED into the client's folder the moment it is submitted - no browser, no
 * print dialog. Layout mirrors `buildResponsePdfHtml`: logo (or the practice's
 * name) centred at the top of EVERY page, the title centred in the practice's
 * accent, a reference line, the Questions | Answers table (accent header band,
 * tinted question column, section rows, statements), and the practice's footer
 * line pinned to the bottom of EVERY page with "Page n of N".
 */

const A4 = { w: 595.28, h: 841.89 };
const M = { side: 40, headerBlock: 118, top: 66, bottom: 52 }; // pt: header space on page 1 (logo + air), content top on later pages, footer reserve
const TABLE_W = A4.w - M.side * 2;
const COL_W = TABLE_W / 2;
const PAD_X = 9;
const PAD_Y = 7.5;
const FS = 8.6;
const LH = FS * 1.5;

function hexToRgb(hex: string | null | undefined, fallback = "#1f6f4a"): RGB {
  const h = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
  return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
}
const mix = (c: RGB, white: number): RGB => rgb(c.red + (1 - c.red) * white, c.green + (1 - c.green) * white, c.blue + (1 - c.blue) * white);
const GRID = rgb(0.35, 0.39, 0.36);
const INK = rgb(0.086, 0.125, 0.106);
const MUTED = rgb(0.48, 0.52, 0.49);
const Q_BG = rgb(0.98, 0.984, 0.98);

/** Greedy word wrap with real Helvetica metrics; long words are hard-split. */
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of (text ?? "").split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(""); continue; }
    let line = "";
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > maxW) {
        // A word wider than the column: peel off what fits.
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxW) cut--;
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else { if (line) out.push(line); line = word; }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

export interface ServerPdfInput {
  formTitle: string;
  fields: FormField[];
  answers: Record<string, string>;
  brand: DocBrand;
  /** Printed under the title and carried in the filename: the session's reference. */
  reference?: string | null;
}

export async function buildResponsePdfBytes(input: ServerPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.formTitle);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const accent = hexToRgb(input.brand.accent);

  // The logo, when it is a format PDF understands (PNG / JPEG); otherwise the name prints.
  let logo: PDFImage | null = null;
  if (input.brand.logoUrl) {
    try {
      const res = await fetch(input.brand.logoUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const type = (res.headers.get("content-type") ?? "").toLowerCase();
        if (type.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50)) logo = await doc.embedPng(bytes);
        else if (type.includes("jpeg") || type.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8)) logo = await doc.embedJpg(bytes);
      }
    } catch { logo = null; }
  }

  const pages: PDFPage[] = [];
  const newPage = () => { const p = doc.addPage([A4.w, A4.h]); pages.push(p); return p; };

  let page = newPage();
  let y = A4.h - M.headerBlock; // page 1: air under the letterhead before the title

  // Title + reference (page 1 only, like the browser document).
  const titleLines = wrap(input.formTitle, bold, 14.5, TABLE_W);
  for (const line of titleLines) {
    page.drawText(line, { x: (A4.w - bold.widthOfTextAtSize(line, 14.5)) / 2, y, size: 14.5, font: bold, color: accent });
    y -= 19;
  }
  if (input.reference) {
    const ref = `Reference ${input.reference}`;
    page.drawText(ref, { x: (A4.w - font.widthOfTextAtSize(ref, 8)) / 2, y: y + 2, size: 8, font, color: MUTED });
    y -= 14;
  }
  y -= 6;

  const drawHeaderBand = (p: PDFPage, top: number): number => {
    const h = 20;
    p.drawRectangle({ x: M.side, y: top - h, width: TABLE_W, height: h, color: accent });
    p.drawText("QUESTIONS:", { x: M.side + PAD_X, y: top - h + 6.5, size: 7.4, font: bold, color: rgb(1, 1, 1) });
    p.drawText("ANSWERS:", { x: M.side + COL_W + PAD_X, y: top - h + 6.5, size: 7.4, font: bold, color: rgb(1, 1, 1) });
    return top - h;
  };

  y = drawHeaderBand(page, y);

  const rows = docRows(input.fields, input.answers);
  for (const r of rows) {
    const isFull = r.kind !== "qa";
    const leftLines = isFull
      ? wrap(r.label, r.kind === "section" ? bold : italic, r.kind === "section" ? 8 : FS, TABLE_W - PAD_X * 2)
      : wrap(r.label, bold, FS, COL_W - PAD_X * 2);
    const rightLines = isFull ? [] : wrap(r.kind === "qa" && r.answered ? r.answer : "-", font, FS, COL_W - PAD_X * 2);
    const rowH = Math.max(leftLines.length, rightLines.length || 1) * LH + PAD_Y * 2;

    if (y - rowH < M.bottom) {
      page = newPage();
      y = drawHeaderBand(page, A4.h - M.top);
    }

    if (r.kind === "section") {
      page.drawRectangle({ x: M.side, y: y - rowH, width: TABLE_W, height: rowH, color: mix(accent, 0.92), borderColor: GRID, borderWidth: 0.75 });
      page.drawRectangle({ x: M.side, y: y - rowH, width: 2.5, height: rowH, color: accent });
      leftLines.forEach((l, i) => page.drawText(l.toUpperCase(), { x: M.side + PAD_X + 2, y: y - PAD_Y - FS - i * LH + 1.5, size: 8, font: bold, color: accent }));
    } else if (r.kind === "statement") {
      page.drawRectangle({ x: M.side, y: y - rowH, width: TABLE_W, height: rowH, color: rgb(0.988, 0.988, 0.984), borderColor: GRID, borderWidth: 0.75 });
      leftLines.forEach((l, i) => page.drawText(l, { x: M.side + PAD_X, y: y - PAD_Y - FS - i * LH + 1.5, size: FS, font: italic, color: rgb(0.29, 0.33, 0.31) }));
    } else {
      page.drawRectangle({ x: M.side, y: y - rowH, width: COL_W, height: rowH, color: Q_BG, borderColor: GRID, borderWidth: 0.75 });
      page.drawRectangle({ x: M.side + COL_W, y: y - rowH, width: COL_W, height: rowH, borderColor: GRID, borderWidth: 0.75 });
      leftLines.forEach((l, i) => page.drawText(l, { x: M.side + PAD_X, y: y - PAD_Y - FS - i * LH + 1.5, size: FS, font: bold, color: rgb(0.13, 0.17, 0.15) }));
      rightLines.forEach((l, i) => page.drawText(l, { x: M.side + COL_W + PAD_X, y: y - PAD_Y - FS - i * LH + 1.5, size: FS, font, color: r.answered ? INK : rgb(0.64, 0.67, 0.65) }));
    }
    y -= rowH;
  }

  // The letterhead + footer on EVERY page (drawn last so "Page n of N" is known).
  const footer = (input.brand.footer ?? "").trim() || `${input.brand.orgName} · Kept confidential under POPIA`;
  pages.forEach((p, i) => {
    if (logo) {
      const maxH = 46, maxW = 170;
      const scale = Math.min(maxH / logo.height, maxW / logo.width, 1);
      const w = logo.width * scale, h = logo.height * scale;
      p.drawImage(logo, { x: (A4.w - w) / 2, y: A4.h - 22 - h, width: w, height: h });
    } else {
      const name = input.brand.orgName || "Phila";
      p.drawText(name, { x: (A4.w - bold.widthOfTextAtSize(name, 14)) / 2, y: A4.h - 40, size: 14, font: bold, color: accent });
    }
    p.drawLine({ start: { x: M.side, y: 34 }, end: { x: A4.w - M.side, y: 34 }, thickness: 0.75, color: mix(accent, 0.8) });
    p.drawText(footer, { x: (A4.w - font.widthOfTextAtSize(footer, 7.6)) / 2, y: 24, size: 7.6, font, color: MUTED });
    const pn = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pn, { x: A4.w - M.side - font.widthOfTextAtSize(pn, 7.2), y: 24, size: 7.2, font, color: MUTED });
  });

  return doc.save();
}
