import { describe, it, expect } from "vitest";
import { stepProgress, encourage } from "@/lib/care/steps";

describe("stepProgress (gentle, never-shaming achievements)", () => {
  it("counts done/total and a rounded percentage", () => {
    const p = stepProgress([{ id: "1", text: "a", done: true }, { id: "2", text: "b", done: false }, { id: "3", text: "c", done: false }]);
    expect(p.done).toBe(1);
    expect(p.total).toBe(3);
    expect(p.pct).toBe(33);
  });

  it("earns 'first step' at one, 'rhythm' at half, 'all' at full", () => {
    const none = stepProgress([{ id: "1", text: "a", done: false }, { id: "2", text: "b", done: false }]);
    expect(none.achievements.find((a) => a.id === "first")!.earned).toBe(false);

    const half = stepProgress([{ id: "1", text: "a", done: true }, { id: "2", text: "b", done: false }]);
    expect(half.achievements.find((a) => a.id === "first")!.earned).toBe(true);
    expect(half.achievements.find((a) => a.id === "rhythm")!.earned).toBe(true);
    expect(half.achievements.find((a) => a.id === "all")!.earned).toBe(false);

    const all = stepProgress([{ id: "1", text: "a", done: true }]);
    expect(all.achievements.find((a) => a.id === "all")!.earned).toBe(true);
  });

  it("is safe on an empty plan (no NaN, nothing earned)", () => {
    const p = stepProgress([]);
    expect(p.pct).toBe(0);
    expect(p.achievements.every((a) => !a.earned)).toBe(true);
  });
});

describe("encourage", () => {
  it("never pressures, and reflects progress", () => {
    expect(encourage(0, 0)).toMatch(/after your next session/i);
    expect(encourage(0, 3)).toMatch(/no rush/i);
    expect(encourage(1, 3)).toContain("1 of 3");
    expect(encourage(3, 3)).toMatch(/proud/i);
  });
});
