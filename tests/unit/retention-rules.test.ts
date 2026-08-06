import { describe, it, expect } from "vitest";
import {
  retentionClock, retentionExpired, erasureDecision, retentionLabel,
  CLINICAL_RETENTION_YEARS, MINOR_RETAIN_UNTIL_AGE,
} from "@/lib/compliance/retention";

/**
 * Phase 31.2 - the HPCSA-aware retention clock. Pure and deterministic:
 * standard ≥6y from last entry; minors until age 21 (later clock wins);
 * incapacity indefinite; legal hold blocks everything.
 */
const NOW = "2026-07-14T12:00:00.000Z";

describe("retentionClock", () => {
  it("standard: 6 years from the LAST entry", () => {
    const c = retentionClock({ lastEntryAt: "2024-03-10T09:00:00.000Z", dateOfBirth: "1990-05-01" });
    expect(c.rule).toBe("standard");
    expect(c.retainUntil!.slice(0, 10)).toBe(`${2024 + CLINICAL_RETENTION_YEARS}-03-10`);
  });

  it("minor at last entry: kept until their 21st birthday when that is LATER", () => {
    // Client born 2010 → 14 at the 2024 session. 21st birthday (2031) > 2030 standard clock.
    const c = retentionClock({ lastEntryAt: "2024-03-10T09:00:00.000Z", dateOfBirth: "2010-06-15" });
    expect(c.rule).toBe("minor");
    expect(c.retainUntil!.slice(0, 10)).toBe(`${2010 + MINOR_RETAIN_UNTIL_AGE}-06-15`);
  });

  it("minor rule never SHORTENS the standard clock", () => {
    // Born 2007, last entry 2024 (age 17 → minor): 21st birthday (2028) < 2030 standard → the LATER standard clock wins.
    const c = retentionClock({ lastEntryAt: "2024-06-01T00:00:00.000Z", dateOfBirth: "2007-01-01" });
    expect(c.rule).toBe("minor");
    expect(c.retainUntil!.slice(0, 10)).toBe("2030-06-01");
  });

  it("adult at last entry: standard rule even with a DOB on file", () => {
    const c = retentionClock({ lastEntryAt: "2024-03-10T09:00:00.000Z", dateOfBirth: "2000-01-01" });
    expect(c.rule).toBe("standard");
  });

  it("incapacity: indefinite", () => {
    const c = retentionClock({ lastEntryAt: "2020-01-01T00:00:00.000Z", incapacitated: true });
    expect(c.retainUntil).toBeNull();
    expect(c.rule).toBe("incapacity");
    expect(retentionExpired(c, "2099-01-01T00:00:00.000Z")).toBe(false);
  });
});

describe("retentionExpired", () => {
  it("flips exactly at the boundary", () => {
    const c = retentionClock({ lastEntryAt: "2020-07-14T12:00:00.000Z" });
    expect(retentionExpired(c, NOW)).toBe(true); // exactly 6y later
    expect(retentionExpired(c, "2026-07-14T11:59:59.000Z")).toBe(false);
  });
});

describe("erasureDecision", () => {
  it("legal hold blocks erasure regardless of the clock", () => {
    const lapsed = retentionClock({ lastEntryAt: "2010-01-01T00:00:00.000Z" });
    const d = erasureDecision(lapsed, NOW, true);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/legal hold/i);
  });

  it("lapsed clock + no hold → destruction lawful", () => {
    const lapsed = retentionClock({ lastEntryAt: "2010-01-01T00:00:00.000Z" });
    expect(erasureDecision(lapsed, NOW, false).allowed).toBe(true);
  });

  it("inside the clock → refused with an honest dated reason", () => {
    const c = retentionClock({ lastEntryAt: "2025-01-01T00:00:00.000Z" });
    const d = erasureDecision(c, NOW, false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("2031-01-01");
    expect(d.reason).toMatch(/HPCSA/);
  });

  it("indefinite retention → refused, incapacity reason", () => {
    const c = retentionClock({ lastEntryAt: "2020-01-01T00:00:00.000Z", incapacitated: true });
    const d = erasureDecision(c, NOW, false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/indefinite/i);
  });
});

describe("retentionLabel", () => {
  it("labels each state calmly", () => {
    expect(retentionLabel(retentionClock({ lastEntryAt: "2025-01-01T00:00:00.000Z" }), NOW)).toMatch(/Retained until 2031-01-01/);
    expect(retentionLabel(retentionClock({ lastEntryAt: "2010-01-01T00:00:00.000Z" }), NOW)).toMatch(/lapsed/);
    expect(retentionLabel(retentionClock({ lastEntryAt: "2020-01-01T00:00:00.000Z", incapacitated: true }), NOW)).toMatch(/indefinitely/);
  });
});
