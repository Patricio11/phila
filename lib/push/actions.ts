"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { getPushPublicKey, saveSubscription, removeSubscription, countSubscriptions, pushToUsers } from "@/lib/push";

const isDb = () => process.env.DATA_PROVIDER === "db";

/** Batch 4m - what the browser needs to decide whether to offer push at all. */
export async function getPushState(): Promise<{ available: boolean; publicKey: string | null; devices: number }> {
  const me = await requireAuth();
  if (!isDb()) return { available: false, publicKey: null, devices: 0 };
  const publicKey = await getPushPublicKey();
  if (!publicKey) return { available: false, publicKey: null, devices: 0 };
  return { available: true, publicKey, devices: await countSubscriptions(me.userId) };
}

const subInput = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(400), auth: z.string().min(5).max(200) }),
  userAgent: z.string().max(300).optional(),
});

export async function savePushSubscription(raw: z.infer<typeof subInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth();
  const parsed = subInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That subscription doesn't look right." };
  if (!isDb() || !(await getPushPublicKey())) return { ok: false, error: "Push notifications aren't switched on for Phila yet." };
  await saveSubscription(me.userId, parsed.data, parsed.data.userAgent ?? null);
  return { ok: true };
}

export async function removePushSubscription(raw: { endpoint: string }): Promise<{ ok: true }> {
  const me = await requireAuth();
  if (isDb() && raw?.endpoint) await removeSubscription(me.userId, String(raw.endpoint));
  return { ok: true };
}

/** "Send me a test" - proves the whole lane end to end on this device. */
export async function sendTestPush(): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const me = await requireAuth();
  if (!isDb()) return { ok: false, error: "Not available in mock mode." };
  const res = await pushToUsers([me.userId], { title: "Phila notifications are on", body: "You'll get a nudge here when someone messages you and you're away.", url: "/open/messages", tag: "phila:test" });
  if (!res.sent) return { ok: false, error: "No device accepted the push - turn notifications on first." };
  return { ok: true, sent: res.sent };
}
