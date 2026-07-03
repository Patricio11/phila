import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Phase 13  video join tokens. Verifies the signed-link guard and that a real,
 * room-scoped LiveKit JWT is minted server-side (no LiveKit server needed to mint).
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const fk = env.match(/^PHILA_FIELD_KEY=(.+)$/m)?.[1]?.trim();
if (fk) process.env.PHILA_FIELD_KEY = fk;

import { signJoin, verifyJoin, videoJoinPath, roomNameForAppointment, mintToken, livekitConfigured, getLivekitConfig } from "@/lib/video/livekit";

function decodeJwt(jwt: string): Record<string, unknown> {
  const payload = jwt.split(".")[1]!;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

describe("video join links", () => {
  it("signs + verifies an appointment, and rejects a forged signature", () => {
    const sig = signJoin("appt_x");
    expect(verifyJoin("appt_x", sig)).toBe(true);
    expect(verifyJoin("appt_x", "wrong")).toBe(false);
    expect(verifyJoin("appt_y", sig)).toBe(false); // sig is per-appointment
    expect(videoJoinPath("appt_x")).toBe(`/room/appt_x?t=${sig}`);
  });
});

describe("mintToken", () => {
  it("issues a JWT scoped to the appointment's room with publish/subscribe", async () => {
    expect(await livekitConfigured()).toBe(true); // admin-managed integration (self-hosted or Cloud)
    const cfg = await getLivekitConfig();
    expect(cfg?.wsUrl).toBeTruthy();
    expect(cfg?.mode === "demo" || cfg?.mode === "live").toBe(true);
    const room = roomNameForAppointment("appt_x");
    const jwt = await mintToken(cfg!, { roomName: room, identity: "host_1", name: "Nomsa", canPublish: true });
    expect(typeof jwt).toBe("string");
    expect(jwt.split(".").length).toBe(3);

    const claims = decodeJwt(jwt) as { video?: { room?: string; roomJoin?: boolean; canPublish?: boolean; canSubscribe?: boolean }; name?: string };
    expect(claims.name).toBe("Nomsa");
    expect(claims.video?.room).toBe(room);
    expect(claims.video?.roomJoin).toBe(true);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canSubscribe).toBe(true);
  });
});
