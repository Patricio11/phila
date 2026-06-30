import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { platformIntegrations } from "@/db/schema";
import { encryptField, decryptField } from "@/lib/crypto";

/** Platform integrations (Phase 15)  super-admin-managed secrets (Phila's own PSP). */

/** Decrypted credentials + enabled flag. Server-only; never sent to the client. */
export async function getPlatformIntegration(key: string): Promise<{ enabled: boolean; creds: Record<string, string> } | null> {
  const [row] = await getDb().select().from(platformIntegrations).where(eq(platformIntegrations.key, key)).limit(1);
  if (!row) return null;
  let creds: Record<string, string> = {};
  if (row.credentialsEnc) {
    try { creds = JSON.parse(decryptField(row.credentialsEnc)) as Record<string, string>; } catch { creds = {}; }
  }
  return { enabled: row.enabled, creds };
}

/** Safe status for the UI  whether it's configured + on, without exposing the key. */
export async function getPlatformIntegrationStatus(key: string): Promise<{ enabled: boolean; configured: boolean }> {
  const [row] = await getDb().select({ enabled: platformIntegrations.enabled, enc: platformIntegrations.credentialsEnc }).from(platformIntegrations).where(eq(platformIntegrations.key, key)).limit(1);
  if (!row) return { enabled: false, configured: false };
  return { enabled: row.enabled, configured: Boolean(row.enc) };
}

export async function savePlatformIntegration(key: string, creds: Record<string, string>, enabled: boolean): Promise<void> {
  const enc = encryptField(JSON.stringify(creds));
  const now = new Date();
  await getDb().insert(platformIntegrations).values({ key, credentialsEnc: enc, enabled, updatedAt: now })
    .onConflictDoUpdate({ target: platformIntegrations.key, set: { credentialsEnc: enc, enabled, updatedAt: now } });
}

export async function setPlatformIntegrationEnabled(key: string, enabled: boolean): Promise<void> {
  await getDb().update(platformIntegrations).set({ enabled, updatedAt: new Date() }).where(eq(platformIntegrations.key, key));
}

/** The live Paystack secret  only when configured AND switched on. Used by lib/payments. */
export async function getPaystackSecret(): Promise<string | null> {
  const it = await getPlatformIntegration("paystack");
  if (!it || !it.enabled) return null;
  return it.creds.secretKey || null;
}
