import { describe, expect, it } from "vitest";
import { billedMinutes } from "@/lib/voice/billing";
import { createHmac } from "node:crypto";
import { twilioSignature } from "@/lib/voice/twilio";

describe("billedMinutes (Phase 33.5)", () => {
  it("rounds UP to the next minute - telephony standard", () => {
    expect(billedMinutes(1)).toBe(1);
    expect(billedMinutes(59)).toBe(1);
    expect(billedMinutes(60)).toBe(1);
    expect(billedMinutes(61)).toBe(2);
    expect(billedMinutes(3000)).toBe(50); // a 50-min session
  });

  it("zero or garbage bills nothing", () => {
    expect(billedMinutes(0)).toBe(0);
    expect(billedMinutes(-5)).toBe(0);
    expect(billedMinutes(NaN)).toBe(0);
  });

  it("honours a custom increment", () => {
    expect(billedMinutes(10, 30)).toBe(0.5); // 30s increment
    expect(billedMinutes(31, 30)).toBe(1);
  });
});

describe("twilioSignature (Phase 33.3)", () => {
  // Twilio's documented ALGORITHM, spelled out by hand: full URL + params
  // appended name-then-value in alphabetical key order, HMAC-SHA1, base64.
  // (The absolute doc vector gets confirmed against Twilio when live creds
  // land; mock mode never relies on it.)
  it("concatenates sorted name+value pairs onto the URL exactly", () => {
    const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
    const params = { To: "+18005551212", CallSid: "CA1", From: "+2711", Digits: "1234" };
    const handBuilt = url + "CallSidCA1" + "Digits1234" + "From+2711" + "To+18005551212";
    const expected = createHmac("sha1", "12345").update(Buffer.from(handBuilt, "utf-8")).digest("base64");
    expect(twilioSignature("12345", url, params)).toBe(expected);
  });

  it("any param change breaks the signature", () => {
    const url = "https://example.com/api/webhooks/voice";
    const good = twilioSignature("secret", url, { CallSid: "CA1", CallStatus: "completed" });
    const bad = twilioSignature("secret", url, { CallSid: "CA1", CallStatus: "failed" });
    expect(good).not.toBe(bad);
  });
});
