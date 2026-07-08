import { describe, it, expect } from "vitest";
import { effectiveFeeCents, feeLabel, isSubsidised } from "@/lib/billing/fees";

describe("sliding-scale fees", () => {
  const LIST = 45000; // R450

  it("standard / null pays the full list price", () => {
    expect(effectiveFeeCents(LIST, null)).toBe(45000);
    expect(effectiveFeeCents(LIST, { kind: "standard" })).toBe(45000);
  });

  it("waived pays nothing", () => {
    expect(effectiveFeeCents(LIST, { kind: "waived" })).toBe(0);
  });

  it("percentage pays that share of the list", () => {
    expect(effectiveFeeCents(LIST, { kind: "percentage", value: 50 })).toBe(22500);
    expect(effectiveFeeCents(LIST, { kind: "percentage", value: 0 })).toBe(0);
    expect(effectiveFeeCents(LIST, { kind: "percentage", value: 100 })).toBe(45000);
  });

  it("percentage clamps out-of-range values", () => {
    expect(effectiveFeeCents(LIST, { kind: "percentage", value: 150 })).toBe(45000);
    expect(effectiveFeeCents(LIST, { kind: "percentage", value: -10 })).toBe(0);
  });

  it("fixed pays a flat amount regardless of list", () => {
    expect(effectiveFeeCents(LIST, { kind: "fixed", value: 15000 })).toBe(15000);
    expect(effectiveFeeCents(90000, { kind: "fixed", value: 15000 })).toBe(15000);
  });

  it("never returns a negative fee", () => {
    expect(effectiveFeeCents(-100, { kind: "standard" })).toBe(0);
    expect(effectiveFeeCents(LIST, { kind: "fixed", value: -1 })).toBe(0);
  });

  it("labels + subsidised flag", () => {
    expect(feeLabel(null)).toBe("Standard fee");
    expect(feeLabel({ kind: "waived" })).toBe("Waived (funded)");
    expect(feeLabel({ kind: "percentage", value: 50 })).toContain("50%");
    expect(isSubsidised(null)).toBe(false);
    expect(isSubsidised({ kind: "waived" })).toBe(true);
  });
});
