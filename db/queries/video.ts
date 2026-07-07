import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgVideoSettings } from "@/db/schema";
import { videoJoinPath } from "@/lib/video/livekit";

export interface VideoSettings {
  mode: "livekit" | "external";
  externalUrl: string | null;
}

const DEFAULT: VideoSettings = { mode: "livekit", externalUrl: null };

export async function getVideoSettings(orgId: string): Promise<VideoSettings> {
  const [row] = await getDb().select().from(orgVideoSettings).where(eq(orgVideoSettings.orgId, orgId)).limit(1);
  if (!row) return DEFAULT;
  return { mode: row.mode === "external" ? "external" : "livekit", externalUrl: row.externalUrl };
}

export async function saveVideoSettings(orgId: string, s: VideoSettings): Promise<void> {
  const values = { orgId, mode: s.mode, externalUrl: s.externalUrl, updatedAt: new Date() };
  await getDb().insert(orgVideoSettings).values(values).onConflictDoUpdate({ target: orgVideoSettings.orgId, set: { mode: s.mode, externalUrl: s.externalUrl, updatedAt: new Date() } });
}

/**
 * The join URL for an online appointment: the in-app LiveKit room, or the org's
 * own pasted meeting link when it runs video externally (paste-link fallback).
 */
export async function resolveVideoJoinUrl(appointmentId: string, orgId: string, startsAtISO: string): Promise<string> {
  const v = await getVideoSettings(orgId);
  return v.mode === "external" && v.externalUrl ? v.externalUrl : videoJoinPath(appointmentId, startsAtISO);
}
