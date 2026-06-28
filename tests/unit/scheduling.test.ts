import { describe, it, expect } from "vitest";
import { isoWeekday, availableSlots } from "@/lib/domain/helpers";
import type { Org, Appointment } from "@/lib/domain/types";

const MON = "2026-06-29"; // a Monday
const TUE = "2026-06-30";
const SUN = "2026-06-28";

function makeOrg(): Org {
  return {
    id: "org_test",
    name: "Test",
    slug: "test",
    brandAccent: "#1C7D58",
    province: "Gauteng",
    timezone: "Africa/Johannesburg",
    features: { ai: false, video: false, whatsapp: false, sms: false, payments: false },
    scheduling: {
      defaultDurationMin: 60,
      bufferMin: 0,
      businessHours: {
        1: { start: "08:00", end: "17:00" },
        2: { start: "08:00", end: "17:00" },
        3: { start: "08:00", end: "17:00" },
        4: { start: "08:00", end: "17:00" },
        5: { start: "08:00", end: "15:00" },
        6: null,
        7: null,
      },
    },
  } as Org;
}

function appt(startsAt: string, durationMin = 60, state: Appointment["state"] = "scheduled"): Appointment {
  return { id: "a", orgId: "org_test", clientId: "c", counsellorId: "co", serviceId: "s", type: "in_person", roomId: "r1", startsAt, durationMin, state } as Appointment;
}

describe("isoWeekday", () => {
  it("anchors at UTC midnight (Monday = 1, Sunday = 7)", () => {
    expect(isoWeekday(MON)).toBe(1);
    expect(isoWeekday(TUE)).toBe(2);
    expect(isoWeekday(SUN)).toBe(7);
  });
});

describe("availableSlots", () => {
  const org = makeOrg();

  it("returns no slots on a closed day", () => {
    expect(availableSlots({ org, date: SUN, existing: [] })).toEqual([]);
  });

  it("fills the open window in duration steps", () => {
    const slots = availableSlots({ org, date: MON, durationMin: 60, existing: [] });
    expect(slots).toHaveLength(9); // 08:00 … 16:00
    expect(slots[0]!.label).toBe("08:00");
    expect(slots.at(-1)!.label).toBe("16:00");
    expect(slots.some((s) => s.label === "16:30")).toBe(false);
  });

  it("excludes a slot that clashes with an existing booking", () => {
    const slots = availableSlots({ org, date: MON, durationMin: 60, existing: [appt(`${MON}T09:00:00+02:00`)] });
    expect(slots).toHaveLength(8);
    expect(slots.some((s) => s.label === "09:00")).toBe(false);
  });

  it("ignores cancelled bookings (non-blocking state)", () => {
    const slots = availableSlots({ org, date: MON, durationMin: 60, existing: [appt(`${MON}T09:00:00+02:00`, 60, "cancelled")] });
    expect(slots).toHaveLength(9);
  });
});
