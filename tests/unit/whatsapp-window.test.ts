import { describe, it, expect } from "vitest";
import {
  whatsappWindowOpen, whatsappWindowHoursLeft, decideWhatsappSend,
  orderedTemplateParams, windowKey, WHATSAPP_WINDOW_MS,
} from "@/lib/messaging/whatsapp-window";

const NOW = "2026-07-08T12:00:00.000Z";
const ago = (mins: number) => new Date(new Date(NOW).getTime() - mins * 60_000).toISOString();

describe("whatsappWindowOpen", () => {
  it("is closed when the client has never messaged", () => {
    expect(whatsappWindowOpen(null, NOW)).toBe(false);
    expect(whatsappWindowOpen(undefined, NOW)).toBe(false);
  });
  it("is open within 24h and closed after", () => {
    expect(whatsappWindowOpen(ago(60), NOW)).toBe(true);       // 1h ago
    expect(whatsappWindowOpen(ago(23 * 60), NOW)).toBe(true);  // 23h ago
    expect(whatsappWindowOpen(ago(25 * 60), NOW)).toBe(false); // 25h ago
  });
  it("closes exactly at the 24h boundary (strictly less-than)", () => {
    const exactly24h = new Date(new Date(NOW).getTime() - WHATSAPP_WINDOW_MS).toISOString();
    expect(whatsappWindowOpen(exactly24h, NOW)).toBe(false);
    expect(whatsappWindowOpen(ago(24 * 60 - 1), NOW)).toBe(true);
  });
});

describe("whatsappWindowHoursLeft", () => {
  it("returns 0 when never messaged or window closed", () => {
    expect(whatsappWindowHoursLeft(null, NOW)).toBe(0);
    expect(whatsappWindowHoursLeft(ago(25 * 60), NOW)).toBe(0);
  });
  it("ceils the remaining hours", () => {
    expect(whatsappWindowHoursLeft(ago(60), NOW)).toBe(23);       // 23h left
    expect(whatsappWindowHoursLeft(ago(23 * 60 + 30), NOW)).toBe(1); // 30m left → 1h
  });
});

describe("decideWhatsappSend", () => {
  it("sends free-form (free) when the window is open", () => {
    expect(decideWhatsappSend({ windowOpen: true, hasTemplate: false })).toBe("free_form");
    expect(decideWhatsappSend({ windowOpen: true, hasTemplate: true })).toBe("free_form");
  });
  it("uses a template outside the window when one is configured", () => {
    expect(decideWhatsappSend({ windowOpen: false, hasTemplate: true })).toBe("template");
  });
  it("refuses to send outside the window with no template (Meta would reject free-form)", () => {
    expect(decideWhatsappSend({ windowOpen: false, hasTemplate: false })).toBe("window_closed");
  });
});

describe("orderedTemplateParams", () => {
  it("emits params in the fixed documented order", () => {
    const vars = { clientName: "Lerato", practiceName: "Masizakhe", serviceName: "Counselling", counsellorName: "Nomsa", date: "Mon 8 Jul", time: "10:00" };
    expect(orderedTemplateParams(vars)).toEqual(["Lerato", "Masizakhe", "Counselling", "Nomsa", "Mon 8 Jul", "10:00"]);
  });
});

describe("windowKey", () => {
  it("matches an inbound wa_id to a stored client phone across formats", () => {
    expect(windowKey("+27 60 318 7742")).toBe(windowKey("+27603187742"));
    expect(windowKey("27603187742")).toBe(windowKey("060 318 7742"));
  });
  it("is null for an unusable phone", () => {
    expect(windowKey(null)).toBeNull();
    expect(windowKey("123")).toBeNull();
  });
});
