import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 13 — paste-link fallback. resolveVideoJoinUrl returns the in-app LiveKit
 * room by default, or the org's own pasted meeting link when video mode = external.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
for (const k of ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "NEXT_PUBLIC_LIVEKIT_URL"]) {
  const v = env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
  if (v) process.env[k] = v;
}
const sql = neon(process.env.DATABASE_URL!);

import { getVideoSettings, saveVideoSettings, resolveVideoJoinUrl } from "@/db/queries/video";

const ORG = "org_masizakhe";

afterAll(async () => {
  await sql`DELETE FROM org_video_settings WHERE org_id=${ORG}`;
});

describe("video paste-link fallback", () => {
  it("defaults to the in-app LiveKit room", async () => {
    await sql`DELETE FROM org_video_settings WHERE org_id=${ORG}`;
    expect((await getVideoSettings(ORG)).mode).toBe("livekit");
    const url = await resolveVideoJoinUrl("appt_x", ORG);
    expect(url.startsWith("/room/appt_x?t=")).toBe(true);
  });

  it("returns the org's own link when mode = external", async () => {
    await saveVideoSettings(ORG, { mode: "external", externalUrl: "https://meet.google.com/abc-defg-hij" });
    const v = await getVideoSettings(ORG);
    expect(v.mode).toBe("external");
    expect(v.externalUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(await resolveVideoJoinUrl("appt_x", ORG)).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("falls back to LiveKit if external is selected but no link is set", async () => {
    await saveVideoSettings(ORG, { mode: "external", externalUrl: null });
    expect((await resolveVideoJoinUrl("appt_x", ORG)).startsWith("/room/appt_x")).toBe(true);
  });
});
