import { describe, expect, it } from "vitest";
import { sessionWithinOrgHours } from "@/lib/domain/helpers";
import type { BusinessHours } from "@/lib/domain/types";

// Mon-Fri 08:00-17:00 with a Wednesday lunch break; weekend closed.
const HOURS: BusinessHours = {
  1: { start: "08:00", end: "17:00" },
  2: { start: "08:00", end: "17:00" },
  3: { start: "08:00", end: "17:00", breaks: [{ start: "13:00", end: "14:00" }] },
  4: { start: "08:00", end: "17:00" },
  5: { start: "08:00", end: "17:00" },
} as BusinessHours;

describe("sessionWithinOrgHours (batch 3u)", () => {
  it("accepts a session inside opening hours", () => {
    expect(sessionWithinOrgHours(HOURS, "2026-08-17", "09:00", 50)).toBe(true); // Monday
  });

  it("refuses a closed day outright", () => {
    expect(sessionWithinOrgHours(HOURS, "2026-08-22", "09:00", 50)).toBe(false); // Saturday
    expect(sessionWithinOrgHours(HOURS, "2026-08-23", "09:00", 50)).toBe(false); // Sunday
  });

  it("refuses starts before opening and ends after closing", () => {
    expect(sessionWithinOrgHours(HOURS, "2026-08-17", "07:30", 50)).toBe(false);
    expect(sessionWithinOrgHours(HOURS, "2026-08-17", "16:30", 50)).toBe(false); // ends 17:20
    expect(sessionWithinOrgHours(HOURS, "2026-08-17", "16:10", 50)).toBe(true); // ends 17:00 exactly
  });

  it("refuses a session across a break", () => {
    expect(sessionWithinOrgHours(HOURS, "2026-08-19", "12:30", 50)).toBe(false); // into Wednesday lunch
    expect(sessionWithinOrgHours(HOURS, "2026-08-19", "14:00", 50)).toBe(true); // right after it
  });
});
