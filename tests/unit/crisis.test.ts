import { describe, it, expect } from "vitest";
import { readsAsCrisis, CRISIS_LINES } from "@/lib/messaging/crisis";

/* Batch 4m - crisis support: conservative, never blocks, SA lines. */
describe("readsAsCrisis", () => {
  it("matches the plain phrases people actually type", () => {
    for (const t of [
      "I want to die",
      "i dont want to be here anymore",
      "I don't wanna live like this",
      "I've been thinking about killing myself",
      "sometimes I think about ending it all",
      "I feel suicidal again tonight",
      "I started self-harming again",
      "everyone would be better off without me",
      "I wish I was dead",
      "there's no point in living",
      "I want to hurt myself",
      "I took an overdose last night",
    ]) expect(readsAsCrisis(t), t).toBe(true);
  });

  it("leaves everyday language alone", () => {
    for (const t of [
      "I'm dying to see you on Thursday",
      "killing it at work this week",
      "dead tired after the kids' party",
      "can we move my session to 3pm?",
      "my brother died last year and I still miss him",
      "thank you for today, it really helped",
      "I live in Soweto now",
      "",
      "ok",
    ]) expect(readsAsCrisis(t), t).toBe(false);
  });

  it("ships the South African 24-hour lines with dialable links", () => {
    const names = CRISIS_LINES.map((l) => l.name);
    expect(names).toContain("SADAG");
    expect(names).toContain("Lifeline");
    expect(CRISIS_LINES.find((l) => l.name === "SADAG")?.phone).toBe("0800 567 567");
    for (const l of CRISIS_LINES) expect(l.href).toMatch(/^(tel|sms):\d+$/);
  });
});
