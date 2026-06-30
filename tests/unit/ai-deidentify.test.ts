import { describe, it, expect } from "vitest";
import { deidentify } from "@/lib/ai/deidentify";

describe("deidentify", () => {
  it("replaces the client's name (full and parts) with [client]", () => {
    const out = deidentify("Lerato said Lerato Mahlangu felt better this week.", ["Lerato Mahlangu"]);
    expect(out).not.toMatch(/Lerato|Mahlangu/);
    expect(out).toContain("[client]");
  });

  it("redacts SA ID numbers, phones, and emails", () => {
    const out = deidentify("ID 8001015009087, call +27 82 123 4567 or me@example.co.za", []);
    expect(out).toContain("[id-number]");
    expect(out).toContain("[phone]");
    expect(out).toContain("[email]");
    expect(out).not.toMatch(/8001015009087|example\.co\.za/);
  });

  it("leaves clinical content intact", () => {
    const out = deidentify("Explored work-life stress and a morning routine.", ["Thandeka"]);
    expect(out).toBe("Explored work-life stress and a morning routine.");
  });
});
