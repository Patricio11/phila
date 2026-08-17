import { describe, expect, it } from "vitest";
import { isOtherOption, otherDetailOf, splitMulti, joinMulti } from "@/components/forms/form-fields";

describe("Other option with input (batch 4c)", () => {
  it("recognises Other in its common spellings", () => {
    expect(isOtherOption("Other")).toBe(true);
    expect(isOtherOption("other")).toBe(true);
    expect(isOtherOption("Other (please specify)")).toBe(true);
    expect(isOtherOption("Mother tongue")).toBe(false);
    expect(isOtherOption("Brother")).toBe(false);
  });

  it("extracts the typed detail from a stored answer", () => {
    expect(otherDetailOf("Other", "Other: Sepedi")).toBe("Sepedi");
    expect(otherDetailOf("Other", "Other")).toBe("");
    expect(otherDetailOf("Other (please specify)", "Other (please specify): Home visit")).toBe("Home visit");
  });

  it("multi-select answers round-trip with an Other detail inside", () => {
    const joined = joinMulti(["Anxiety", "Other: work stress"]);
    expect(splitMulti(joined)).toEqual(["Anxiety", "Other: work stress"]);
  });
});
