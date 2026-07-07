import { describe, it, expect } from "vitest";
import { planIncludesFeature, FEATURE_REGISTRY, FEATURE_LIST } from "@/lib/domain/features";
import { ORG_FEATURES } from "@/lib/domain/enums";
import { PLANS, planById } from "@/lib/billing/plans";

/** W3.1 — the feature registry + plan-entitlement mapping (pure). */
describe("feature registry", () => {
  it("describes every ORG_FEATURE exactly once", () => {
    expect(FEATURE_LIST.map((f) => f.key).sort()).toEqual([...ORG_FEATURES].sort());
    for (const f of ORG_FEATURES) expect(FEATURE_REGISTRY[f].label).toBeTruthy();
  });
});

describe("planIncludesFeature", () => {
  const practice = planById("p_practice")!; // no AI, no video, no messaging
  const programme = planById("p_programme")!; // AI + video + messaging

  it("gates AI / video / messaging on the plan's allowances", () => {
    expect(planIncludesFeature(practice, "ai")).toBe(false);
    expect(planIncludesFeature(practice, "video")).toBe(false);
    expect(planIncludesFeature(practice, "sms")).toBe(false);
    expect(planIncludesFeature(programme, "ai")).toBe(true);
    expect(planIncludesFeature(programme, "video")).toBe(true);
    expect(planIncludesFeature(programme, "whatsapp")).toBe(true);
  });

  it("always includes payments + funders, on every plan", () => {
    for (const plan of PLANS) {
      expect(planIncludesFeature(plan, "payments")).toBe(true);
      expect(planIncludesFeature(plan, "funders")).toBe(true);
    }
  });

  it("fails open for an unknown plan (never blocks)", () => {
    expect(planIncludesFeature(undefined, "ai")).toBe(true);
  });
});
