"use server";

import { requireAuth } from "@/lib/auth/guard";
import { touchPresence, prunePresence } from "@/lib/messaging/presence";

/** Phase 34.2 - the shell's heartbeat: "I'm here". Any signed-in principal. */
export async function heartbeat(): Promise<{ ok: true }> {
  const principal = await requireAuth();
  if (process.env.DATA_PROVIDER !== "db") return { ok: true };
  await touchPresence(principal.userId);
  if (Math.random() < 0.02) await prunePresence().catch(() => {});
  return { ok: true };
}
