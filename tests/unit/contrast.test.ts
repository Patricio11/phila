import { describe, it, expect } from "vitest";
import { hexToRgb, contrastRatio, contrastSafeAccent } from "@/lib/contrast";

describe("contrast helper (WCAG)", () => {
  it("hexToRgb parses 6-digit hex", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("black on white is the maximum ratio (~21:1)", () => {
    const r = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(Math.round(r)).toBe(21);
  });

  it("same colour is 1:1", () => {
    expect(contrastRatio({ r: 18, g: 18, b: 18 }, { r: 18, g: 18, b: 18 })).toBeCloseTo(1, 5);
  });

  it("contrastSafeAccent returns a hex that clears the minimum against white", () => {
    const safe = contrastSafeAccent("#7bd6a8"); // a light accent on white fails AA
    expect(safe).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(contrastRatio(hexToRgb(safe), { r: 255, g: 255, b: 255 })).toBeGreaterThanOrEqual(4.5);
  });
});
