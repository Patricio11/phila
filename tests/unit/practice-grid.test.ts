import { describe, expect, it } from "vitest";
import { practiceGridTimes } from "@/lib/domain/helpers";
import type { BusinessHours } from "@/lib/domain/types";

const HOURS = { 1: { start: "08:00", end: "17:00" } } as BusinessHours;

describe("practiceGridTimes (batch 3y)", () => {
  it("steps by duration + interval from opening time", () => {
    // Monday 08:00-17:00, 50 min sessions, 10 min interval -> on the hour.
    expect(practiceGridTimes(HOURS, "2026-08-17", 50, 10)).toEqual([
      "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00",
    ]);
  });

  it("only offers starts whose whole session fits before close", () => {
    const times = practiceGridTimes(HOURS, "2026-08-17", 90, 0);
    expect(times[0]).toBe("08:00");
    expect(times[times.length - 1]).toBe("15:30"); // 15:30 + 90 = 17:00 exactly
  });

  it("returns nothing on a closed day", () => {
    expect(practiceGridTimes(HOURS, "2026-08-22", 50, 10)).toEqual([]); // Saturday
  });
});
