import { describe, it, expect } from "vitest";
import { periodWindows, inWindow, DASH_PERIODS } from "@/lib/dashboard/periods";

/**
 * The dashboard's one filter drives the tiles AND the widgets, so these windows
 * have to be right in SAST wall-clock terms (UTC+2, no DST) - a session at
 * 00:30 on Monday belongs to Monday, not to Sunday night.
 */
describe("dashboard period windows", () => {
  // Wednesday 12 August 2026, 09:00 SAST.
  const now = "2026-08-12T07:00:00.000Z";
  const w = periodWindows(now);

  it("labels every period the filter offers", () => {
    expect(DASH_PERIODS.map((p) => p.key)).toEqual(["today", "week", "month", "lastMonth"]);
    expect([w.today.label, w.week.label, w.month.label, w.lastMonth.label])
      .toEqual(["today", "this week", "this month", "last month"]);
  });

  it("starts each window at SAST midnight, not UTC midnight", () => {
    expect(w.today.from.toISOString()).toBe("2026-08-11T22:00:00.000Z"); // 12 Aug 00:00 SAST
    expect(w.today.to.toISOString()).toBe("2026-08-12T22:00:00.000Z");
    expect(w.month.from.toISOString()).toBe("2026-07-31T22:00:00.000Z"); // 01 Aug 00:00 SAST
  });

  it("runs the week Monday to Sunday", () => {
    expect(w.week.from.toISOString()).toBe("2026-08-09T22:00:00.000Z"); // Mon 10 Aug
    expect(w.week.to.toISOString()).toBe("2026-08-16T22:00:00.000Z"); // Mon 17 Aug
  });

  it("rolls the month over correctly", () => {
    expect(w.month.to.toISOString()).toBe("2026-08-31T22:00:00.000Z"); // 01 Sep
    expect(w.lastMonth.from.toISOString()).toBe("2026-06-30T22:00:00.000Z"); // 01 Jul
    expect(w.lastMonth.to.toISOString()).toBe("2026-07-31T22:00:00.000Z"); // 01 Aug
  });

  it("puts a late-night SAST session in the right day", () => {
    const lateTonight = "2026-08-12T21:30:00.000Z"; // 23:30 SAST on the 12th
    expect(inWindow(lateTonight, w.today)).toBe(true);
    const justAfterMidnight = "2026-08-12T22:30:00.000Z"; // 00:30 SAST on the 13th
    expect(inWindow(justAfterMidnight, w.today)).toBe(false);
    expect(inWindow(justAfterMidnight, w.week)).toBe(true);
  });

  it("keeps the windows honest at their edges", () => {
    expect(inWindow(w.month.from.toISOString(), w.month)).toBe(true); // inclusive start
    expect(inWindow(w.month.to.toISOString(), w.month)).toBe(false); // exclusive end
    expect(inWindow(w.lastMonth.to.toISOString(), w.month)).toBe(true); // they meet, no gap
  });

  it("nests today inside the week inside the month", () => {
    expect(w.today.from.getTime()).toBeGreaterThanOrEqual(w.week.from.getTime());
    expect(w.week.from.getTime()).toBeGreaterThanOrEqual(w.month.from.getTime());
    expect(w.today.to.getTime()).toBeLessThanOrEqual(w.month.to.getTime());
  });
});
