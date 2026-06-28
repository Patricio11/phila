import { describe, it, expect } from "vitest";
import { isConsentActive, grant, revoke, assertConsent, ConsentError, type Consent } from "@/lib/consent";

const NOW = "2026-06-29T09:00:00+02:00";

describe("consent state machine (Consent-Before-Capture)", () => {
  it("none → not active", () => {
    expect(isConsentActive(undefined)).toBe(false);
  });

  it("grant makes a purpose active at a version", () => {
    const c = grant(undefined, "demographics", 1, NOW);
    expect(c.state).toBe("granted");
    expect(c.version).toBe(1);
    expect(isConsentActive(c)).toBe(true);
  });

  it("revoke deactivates", () => {
    const granted = grant(undefined, "demographics", 1, NOW);
    const revoked = revoke(granted, "demographics", NOW);
    expect(revoked.state).toBe("revoked");
    expect(isConsentActive(revoked)).toBe(false);
  });

  it("re-grants at the current version, never silently reusing the old", () => {
    const revoked = revoke(grant(undefined, "demographics", 1, NOW), "demographics", NOW);
    const regranted = grant(revoked, "demographics", 2, NOW);
    expect(regranted.state).toBe("granted");
    expect(regranted.version).toBe(2);
  });

  it("rejects an invalid version and a purpose mismatch", () => {
    expect(() => grant(undefined, "demographics", 0, NOW)).toThrow(ConsentError);
    const c: Consent = { purpose: "demographics", state: "granted", version: 1, updatedAt: NOW };
    expect(() => grant(c, "ai_processing", 1, NOW)).toThrow(ConsentError);
  });

  it("cannot revoke what was never granted", () => {
    expect(() => revoke(undefined, "demographics", NOW)).toThrow(ConsentError);
  });

  it("assertConsent throws on a missing/inactive grant", () => {
    expect(() => assertConsent(undefined, "demographics")).toThrow(ConsentError);
    const revoked = revoke(grant(undefined, "demographics", 1, NOW), "demographics", NOW);
    expect(() => assertConsent(revoked, "demographics")).toThrow(ConsentError);
  });
});
