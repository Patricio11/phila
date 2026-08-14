import { describe, expect, it } from "vitest";
import { appointmentReference, matchesReference, parseAppointmentReference } from "@/lib/scheduling/reference";
import { withReference, renderTemplate } from "@/lib/messaging/templates";

describe("appointment reference (batch 3l)", () => {
  it("derives a stable APT code from the id's tail", () => {
    expect(appointmentReference("appt_9971fee9c3a4")).toBe("APT-E9C3A4");
    expect(appointmentReference("appt_9971fee9c3a4")).toBe(appointmentReference("appt_9971fee9c3a4"));
  });

  it("parses what a person types, forgivingly", () => {
    expect(parseAppointmentReference("APT-E9C3A4")).toBe("e9c3a4");
    expect(parseAppointmentReference("apt e9c3a4")).toBe("e9c3a4");
    expect(parseAppointmentReference("  e9c3a4 ")).toBe("e9c3a4");
  });

  it("never false-matches ordinary search words", () => {
    expect(parseAppointmentReference("lerato")).toBeNull();
    expect(parseAppointmentReference("invoice")).toBeNull();
    expect(parseAppointmentReference("apt")).toBeNull(); // too short to be a code
    expect(parseAppointmentReference("abc")).toBeNull();
  });

  it("matches an id against a typed reference", () => {
    expect(matchesReference("appt_9971fee9c3a4", "APT-E9C3A4")).toBe(true);
    expect(matchesReference("appt_9971fee9c3a4", "e9c3a4")).toBe(true);
    expect(matchesReference("appt_9971fee9c3a4", "APT-111111")).toBe(false);
  });
});

describe("withReference (batch 3l) - notifications always carry the ref", () => {
  it("appends a Ref line when the template doesn't place it", () => {
    expect(withReference("See you Thursday.", "APT-E9C3A4")).toBe("See you Thursday.\n\nRef: APT-E9C3A4");
  });

  it("leaves the body alone when a custom template already placed {reference}", () => {
    const body = renderTemplate("Your booking {reference} is confirmed.", { reference: "APT-E9C3A4" });
    expect(body).toBe("Your booking APT-E9C3A4 is confirmed.");
    expect(withReference(body, "APT-E9C3A4")).toBe(body);
  });

  it("is a no-op without a reference (non-appointment messages)", () => {
    expect(withReference("A document was shared.", undefined)).toBe("A document was shared.");
    expect(withReference("A document was shared.", null)).toBe("A document was shared.");
  });
});
