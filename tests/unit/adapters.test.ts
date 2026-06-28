import { describe, it, expect } from "vitest";
import { getAdapters, adapters, AdapterDormantError } from "@/lib/adapters";

describe("adapters  Dormant-by-Default (Rule #5)", () => {
  it("every adapter ships 'off'", () => {
    expect(adapters.storage.status).toBe("off");
    expect(adapters.ai.status).toBe("off");
    expect(adapters.payments.status).toBe("off");
    expect(adapters.video.status).toBe("off");
    expect(adapters.notifications.status).toEqual({ whatsapp: "off", sms: "off", email: "off" });
  });

  it("storage / ai / payments / video throw AdapterDormantError until configured", async () => {
    await expect(adapters.storage.put({ orgId: "o", path: "x", contentType: "application/pdf" })).rejects.toBeInstanceOf(AdapterDormantError);
    await expect(adapters.ai.draftNote({ cues: "…" })).rejects.toBeInstanceOf(AdapterDormantError);
    await expect(adapters.payments.charge({ surface: "platform", orgId: "o", amountCents: 1000, reference: "r", idempotencyKey: "k" })).rejects.toBeInstanceOf(AdapterDormantError);
    await expect(adapters.video.createRoom({ appointmentId: "a" })).rejects.toBeInstanceOf(AdapterDormantError);
  });

  it("notifications queue but never claim delivery while dormant (honest)", async () => {
    const r = await adapters.notifications.send({ channel: "whatsapp", to: "+27…", template: "reminder" });
    expect(r).toEqual({ queued: true, delivered: false });
  });

  it("getAdapters() returns the active set", () => {
    expect(getAdapters()).toBe(adapters);
  });
});
