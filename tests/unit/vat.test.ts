import { describe, it, expect } from "vitest";
import { computeVat } from "@/lib/domain/helpers";

describe("computeVat", () => {
  it("adds VAT when prices are exclusive (registered)", () => {
    const r = computeVat({ amountCents: 100000, vatRatePercent: 15, vatRegistered: true, pricesIncludeVat: false });
    expect(r).toEqual({ exVatCents: 100000, vatCents: 15000, totalCents: 115000 });
  });

  it("extracts VAT when prices are inclusive (registered)", () => {
    const r = computeVat({ amountCents: 115000, vatRatePercent: 15, vatRegistered: true, pricesIncludeVat: true });
    expect(r.totalCents).toBe(115000);
    expect(r.exVatCents).toBe(100000);
    expect(r.vatCents).toBe(15000);
  });

  it("charges no VAT when the org isn't registered", () => {
    const r = computeVat({ amountCents: 45000, vatRatePercent: 15, vatRegistered: false, pricesIncludeVat: false });
    expect(r).toEqual({ exVatCents: 45000, vatCents: 0, totalCents: 45000 });
  });

  it("tracks a changed national rate (one platform change, everyone gets it)", () => {
    const r = computeVat({ amountCents: 100000, vatRatePercent: 16, vatRegistered: true, pricesIncludeVat: false });
    expect(r.vatCents).toBe(16000);
    expect(r.totalCents).toBe(116000);
  });
});
