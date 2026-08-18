import { describe, expect, it } from "vitest";
import { shouldAlert, shouldNudgeExternally } from "@/lib/messaging/nudge-rules";
import { isOnlineAt, ONLINE_MS } from "@/lib/messaging/presence";

describe("shouldAlert - one alert per thread until read (Phase 34.2)", () => {
  it("alerts when never alerted", () => {
    expect(shouldAlert({ nudgedAt: null, lastReadAt: null })).toBe(true);
    expect(shouldAlert({ nudgedAt: null, lastReadAt: "2026-08-18T10:00:00Z" })).toBe(true);
  });
  it("does NOT alert again while the earlier alert is unread", () => {
    expect(shouldAlert({ nudgedAt: "2026-08-18T10:00:00Z", lastReadAt: null })).toBe(false);
    expect(shouldAlert({ nudgedAt: "2026-08-18T10:00:00Z", lastReadAt: "2026-08-18T09:00:00Z" })).toBe(false);
  });
  it("re-arms once they have read past the alert", () => {
    expect(shouldAlert({ nudgedAt: "2026-08-18T10:00:00Z", lastReadAt: "2026-08-18T10:00:00Z" })).toBe(true);
    expect(shouldAlert({ nudgedAt: "2026-08-18T10:00:00Z", lastReadAt: "2026-08-18T10:05:00Z" })).toBe(true);
  });
});

describe("shouldNudgeExternally", () => {
  it("only when offline AND the org allows it", () => {
    expect(shouldNudgeExternally({ online: false, alertsOn: true })).toBe(true);
    expect(shouldNudgeExternally({ online: true, alertsOn: true })).toBe(false);
    expect(shouldNudgeExternally({ online: false, alertsOn: false })).toBe(false);
  });
});

describe("isOnlineAt - the 2-minute presence boundary", () => {
  const now = new Date("2026-08-18T10:00:00Z");
  it("recent heartbeat = online", () => {
    expect(isOnlineAt(new Date(now.getTime() - 30_000), now)).toBe(true);
    expect(isOnlineAt(new Date(now.getTime() - ONLINE_MS + 1), now)).toBe(true);
  });
  it("stale or missing = offline", () => {
    expect(isOnlineAt(new Date(now.getTime() - ONLINE_MS), now)).toBe(false);
    expect(isOnlineAt(null, now)).toBe(false);
    expect(isOnlineAt(undefined, now)).toBe(false);
  });
});
