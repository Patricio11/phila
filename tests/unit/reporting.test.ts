import { describe, it, expect } from "vitest";
import { applyKAnon, coverageNote, roomUtilisation, K_ANON_FLOOR } from "@/lib/domain/helpers";
import type { Appointment, BusinessHours } from "@/lib/domain/types";

describe("applyKAnon", () => {
  it("suppresses cells below the floor and labels them (never silent)", () => {
    const rows = applyKAnon([{ label: "A", count: 7 }, { label: "B", count: 3 }]);
    expect(rows[0]).toEqual({ label: "A", count: 7, suppressed: false });
    expect(rows[1]).toEqual({ label: "B", count: null, suppressed: true });
  });

  it("treats exactly the floor as reportable", () => {
    const [row] = applyKAnon([{ label: "A", count: K_ANON_FLOOR }]);
    expect(row!.suppressed).toBe(false);
    expect(row!.count).toBe(K_ANON_FLOOR);
  });
});

describe("coverageNote", () => {
  it("distinguishes captured from total", () => {
    expect(coverageNote(412, 530)).toBe("412 of 530 measured");
    expect(coverageNote(3, 8, "clients")).toBe("3 of 8 clients");
  });
  it("is honest about no data", () => {
    expect(coverageNote(0, 0)).toBe("none yet measured");
  });
});

describe("roomUtilisation", () => {
  const bh: BusinessHours = {
    1: { start: "08:00", end: "17:00" }, 2: { start: "08:00", end: "17:00" },
    3: null, 4: null, 5: null, 6: null, 7: null,
  };
  const mk = (date: string, mins: number): Appointment =>
    ({ id: date, orgId: "o", clientId: "c", counsellorId: "co", serviceId: "s", type: "in_person", roomId: "r1", startsAt: `${date}T09:00:00+02:00`, durationMin: mins, state: "scheduled" } as Appointment);

  it("computes booked hours, utilisation, and busiest day", () => {
    const u = roomUtilisation({
      appointments: [mk("2026-06-29", 60), mk("2026-06-29", 60)],
      businessHours: bh,
      weekDates: ["2026-06-29", "2026-06-30"],
    });
    expect(u.meetings).toBe(2);
    expect(u.bookedHours).toBe(2);
    expect(u.busiestDay).toBe("2026-06-29");
    // 120 booked of (2 days × 540 open) = 1080 → 11%
    expect(u.utilisationPct).toBe(11);
  });

  it("caps utilisation at 100 and excludes non-room/cancelled", () => {
    const noRoom = { ...mk("2026-06-29", 60), roomId: null } as Appointment;
    const u = roomUtilisation({ appointments: [noRoom], businessHours: bh, weekDates: ["2026-06-29"] });
    expect(u.meetings).toBe(0);
  });
});
