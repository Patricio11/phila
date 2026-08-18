import { describe, expect, it } from "vitest";
import { effectiveLimit, mergeHealth, parseHealthEvent, sendsPaused, tierToLimit, HEALTHY } from "@/lib/messaging/whatsapp-health";
import { isTransient, withRetry, nextDeliveryState, maskTarget, backoffMs } from "@/lib/messaging/retry";

describe("WhatsApp number health (Phase 34.3)", () => {
  it("scales the send ceiling by quality, floor 5", () => {
    expect(effectiveLimit({ quality: "green", status: "connected" }, 60)).toBe(60);
    expect(effectiveLimit({ quality: "yellow", status: "connected" }, 60)).toBe(30);
    expect(effectiveLimit({ quality: "green", status: "flagged" }, 60)).toBe(30);
    expect(effectiveLimit({ quality: "red", status: "connected" }, 60)).toBe(15);
    expect(effectiveLimit({ quality: "red", status: "connected" }, 8)).toBe(5);
  });
  it("pauses only on restricted / banned", () => {
    expect(sendsPaused("connected")).toBe(false);
    expect(sendsPaused("flagged")).toBe(false);
    expect(sendsPaused("restricted")).toBe(true);
    expect(sendsPaused("banned")).toBe(true);
  });
  it("maps Meta's tiers", () => {
    expect(tierToLimit("TIER_250")).toBe(250);
    expect(tierToLimit("TIER_1K")).toBe(1000);
    expect(tierToLimit("TIER_UNLIMITED")).toBe(-1);
    expect(tierToLimit(undefined)).toBe(-1);
  });
  it("parses quality + account events", () => {
    expect(parseHealthEvent("phone_number_quality_update", { display_phone_number: "+27 87 123 4567", event: "FLAGGED", current_quality_score: "RED", current_limit: "TIER_1K" }))
      .toEqual({ displayPhone: "+27 87 123 4567", quality: "red", tierLabel: "TIER_1K", dailyLimit: 1000, status: "flagged" });
    expect(parseHealthEvent("phone_number_quality_update", { event: "UNFLAGGED", current_quality_score: "GREEN" })).toEqual({ quality: "green", status: "connected" });
    expect(parseHealthEvent("account_update", { event: "ACCOUNT_RESTRICTION" })).toEqual({ status: "restricted" });
    expect(parseHealthEvent("account_update", { event: "ACCOUNT_VIOLATION_BAN" })).toEqual({ status: "banned" });
    expect(parseHealthEvent("account_update", { event: "PARTNER_ADDED" })).toBeNull();
    expect(parseHealthEvent("messages", { messages: [] })).toBeNull();
  });
  it("stamps flaggedAt on entry to a bad state and clears it on recovery", () => {
    const t = new Date("2026-08-18T10:00:00Z");
    const flagged = mergeHealth(HEALTHY, { status: "flagged" }, t);
    expect(flagged.flaggedAt).toBe(t.toISOString());
    const still = mergeHealth(flagged, { quality: "yellow" }, new Date("2026-08-19T10:00:00Z"));
    expect(still.flaggedAt).toBe(t.toISOString()); // unchanged while still bad
    const ok = mergeHealth(still, { status: "connected", quality: "green" }, new Date("2026-08-20T10:00:00Z"));
    expect(ok.flaggedAt).toBeNull();
  });
});

describe("retry + delivery ordering (Phase 34.3)", () => {
  it("classifies transient vs permanent", () => {
    expect(isTransient("Meta HTTP 503")).toBe(true);
    expect(isTransient("BulkSMS HTTP 429")).toBe(true);
    expect(isTransient("fetch failed")).toBe(true);
    expect(isTransient("The operation was aborted due to timeout")).toBe(true);
    expect(isTransient("Meta HTTP 400")).toBe(false);
    expect(isTransient("Resend HTTP 401")).toBe(false);
    expect(isTransient(undefined)).toBe(false);
  });
  it("retries only transient failures, with backoff, then gives up", async () => {
    const sleeps: number[] = [];
    let n = 0;
    const r = await withRetry(async () => { n += 1; return { status: "failed", detail: "Meta HTTP 503" }; }, { sleep: async (ms) => { sleeps.push(ms); }, rand: () => 0.5 });
    expect(r.attempts).toBe(3);
    expect(n).toBe(3);
    expect(r.result.status).toBe("failed");
    expect(sleeps).toEqual([250, 1000]); // rand 0.5 = no jitter
    let m = 0;
    const p = await withRetry(async () => { m += 1; return { status: "failed", detail: "Meta HTTP 400" }; }, { sleep: async () => {} });
    expect(p.attempts).toBe(1); // permanent - fail fast
    let k = 0;
    const s = await withRetry(async () => { k += 1; return k < 2 ? { status: "failed", detail: "network" } : { status: "sent", providerMessageId: "x" }; }, { sleep: async () => {} });
    expect(s.attempts).toBe(2);
    expect(s.result.status).toBe("sent");
  });
  it("jitters +/- 25%", () => {
    expect(backoffMs(1, 250, () => 0)).toBe(188);
    expect(backoffMs(1, 250, () => 1)).toBe(313);
    expect(backoffMs(3, 250, () => 0.5)).toBe(4000);
  });
  it("delivery states never regress", () => {
    expect(nextDeliveryState("sent", "delivered")).toBe("delivered");
    expect(nextDeliveryState("delivered", "sent")).toBe("delivered");
    expect(nextDeliveryState("read", "delivered")).toBe("read");
    expect(nextDeliveryState("sent", "read")).toBe("read");
    expect(nextDeliveryState("sent", "failed")).toBe("failed");
    expect(nextDeliveryState("delivered", "failed")).toBe("delivered"); // a late failure can't undo a delivery
    expect(nextDeliveryState("dormant", "delivered")).toBe("delivered");
  });
  it("masks recipients for ops tables", () => {
    expect(maskTarget("+27824517720")).toBe("+27•••20");
    expect(maskTarget("lerato.m@example.co.za")).toBe("l•••@example.co.za");
  });
});
