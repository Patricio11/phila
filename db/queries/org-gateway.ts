import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgPaymentConnections } from "@/db/schema";
import { encryptField, decryptField } from "@/lib/crypto";

/** Org's own payment gateway (Phase 15B) — clients pay the org directly. */

/** Safe status for the UI — provider + flags, never the secret. */
export async function getOrgGatewayStatus(orgId: string): Promise<{ provider: string | null; enabled: boolean; configured: boolean }> {
  const [row] = await getDb().select({ provider: orgPaymentConnections.provider, enabled: orgPaymentConnections.enabled, enc: orgPaymentConnections.credentialsEnc }).from(orgPaymentConnections).where(eq(orgPaymentConnections.orgId, orgId)).limit(1);
  if (!row) return { provider: null, enabled: false, configured: false };
  return { provider: row.provider, enabled: row.enabled, configured: Boolean(row.enc) };
}

function decodeCreds(enc: string | null): Record<string, string> {
  if (!enc) return {};
  try { return JSON.parse(decryptField(enc)) as Record<string, string>; } catch { return {}; }
}

/** The org's stored credentials (decrypted). Server-only; used to keep a key on blank-save. */
export async function getOrgGatewayCreds(orgId: string): Promise<Record<string, string>> {
  const [row] = await getDb().select({ enc: orgPaymentConnections.credentialsEnc }).from(orgPaymentConnections).where(eq(orgPaymentConnections.orgId, orgId)).limit(1);
  return decodeCreds(row?.enc ?? null);
}

/** The live secret for charging — only when configured AND switched on. */
export async function getOrgGatewaySecret(orgId: string): Promise<{ provider: string; secretKey: string } | null> {
  const [row] = await getDb().select().from(orgPaymentConnections).where(eq(orgPaymentConnections.orgId, orgId)).limit(1);
  if (!row || !row.enabled) return null;
  const creds = decodeCreds(row.credentialsEnc);
  if (!creds.secretKey) return null;
  return { provider: row.provider, secretKey: creds.secretKey };
}

export async function saveOrgGateway(orgId: string, provider: string, creds: Record<string, string>, enabled: boolean): Promise<void> {
  const enc = encryptField(JSON.stringify(creds));
  const now = new Date();
  await getDb().insert(orgPaymentConnections).values({ orgId, provider, credentialsEnc: enc, enabled, updatedAt: now })
    .onConflictDoUpdate({ target: orgPaymentConnections.orgId, set: { provider, credentialsEnc: enc, enabled, updatedAt: now } });
}
