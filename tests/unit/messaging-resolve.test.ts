import { describe, it, expect } from "vitest";
import { preferredChannel, resolveChannel, withinQuietHours } from "@/lib/messaging/resolve";

describe("preferredChannel", () => {
  it("maps the intake preference to a channel ('Phone call' → SMS)", () => {
    expect(preferredChannel("WhatsApp")).toBe("whatsapp");
    expect(preferredChannel("Email")).toBe("email");
    expect(preferredChannel("Phone call")).toBe("sms");
    expect(preferredChannel(null)).toBeNull();
  });
});

describe("resolveChannel", () => {
  const all = { whatsapp: true, sms: true, email: true };
  it("honours the client's preference when that channel is enabled", () => {
    expect(resolveChannel("Email", all)).toBe("email");
    expect(resolveChannel("WhatsApp", all)).toBe("whatsapp");
  });
  it("falls back in order when the preferred channel is off", () => {
    expect(resolveChannel("WhatsApp", { whatsapp: false, sms: true, email: true })).toBe("sms");
    expect(resolveChannel("Email", { whatsapp: false, sms: false, email: false })).toBeNull();
  });
  it("uses the fallback order when there's no stated preference", () => {
    expect(resolveChannel(null, { whatsapp: false, sms: false, email: true })).toBe("email");
    expect(resolveChannel(null, all)).toBe("whatsapp");
  });
});

describe("withinQuietHours", () => {
  it("returns false when no bounds are set", () => {
    expect(withinQuietHours("23:00", null, null)).toBe(false);
  });
  it("handles a same-day window", () => {
    expect(withinQuietHours("13:00", "12:00", "14:00")).toBe(true);
    expect(withinQuietHours("11:59", "12:00", "14:00")).toBe(false);
  });
  it("handles an overnight window (21:00–07:00)", () => {
    expect(withinQuietHours("22:30", "21:00", "07:00")).toBe(true);
    expect(withinQuietHours("03:00", "21:00", "07:00")).toBe(true);
    expect(withinQuietHours("07:00", "21:00", "07:00")).toBe(false);
    expect(withinQuietHours("12:00", "21:00", "07:00")).toBe(false);
  });
});
