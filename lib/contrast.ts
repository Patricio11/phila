/**
 * Contrast utilities (WCAG 2.2). Each org's public page may set its own
 * `--brand-accent`; we must keep white-on-accent buttons readable (AA), so an
 * accent that fails is auto-darkened until it passes (DESIGN.md §9). This is the
 * only per-tenant colour, scoped to that page — the rest stays Phila's system.
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

const AA_NORMAL = 4.5;

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Relative luminance per WCAG. */
export function relativeLuminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };

/**
 * Return an accent that meets AA for white text, darkening the supplied colour
 * if needed. Used so an org's `--brand-accent` is always safe on its buttons.
 */
export function contrastSafeAccent(hex: string, against: RGB = WHITE, min = AA_NORMAL): string {
  let rgb = hexToRgb(hex);
  if (contrastRatio(rgb, against) >= min) return rgbToHex(rgb);

  // Darken toward black in small steps until it passes (or we bottom out).
  for (let i = 0; i < 24; i++) {
    rgb = { r: rgb.r * 0.92, g: rgb.g * 0.92, b: rgb.b * 0.92 };
    if (contrastRatio(rgb, against) >= min) break;
  }
  return rgbToHex(rgb);
}
