import { describe, expect, it } from "vitest";
import { lowCreditEmail } from "@/lib/messaging/low-credit";

describe("lowCreditEmail (batch 4e)", () => {
  it("names the channel, the unit and the remaining amount", () => {
    const m = lowCreditEmail("video", 2630, "low", "https://philasa.com");
    expect(m.subject).toBe("LivePhila minutes running low - 2,630 left");
    expect(m.body).toContain("2,630 LivePhila minutes");
    expect(m.body).toContain("https://philasa.com/hub/billing");
  });

  it("the empty notice is urgent but never claims care stops", () => {
    const m = lowCreditEmail("video", 0, "empty", "https://philasa.com");
    expect(m.subject).toContain("Out of LivePhila minutes");
    expect(m.body).toContain("Online sessions still run");
  });

  it("sms empty says messages stop - because they do", () => {
    const m = lowCreditEmail("sms", 0, "empty", "https://philasa.com");
    expect(m.body).toContain("can't go out until you top up");
  });
});
