"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { CONSENT_PURPOSES } from "@/lib/domain/enums";
import { getDb } from "@/db/client";
import { consents as consentsTable } from "@/db/schema";

/**
 * Change a consent (Consent-Before-Capture). The client owns this — grant or
 * revoke a single purpose. Persisted to the versioned `consents` table (grant
 * bumps the version; revoke keeps it) and audited. Every purpose-bound read
 * checks the live state, so a revoke takes effect immediately.
 */
const input = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  grant: z.boolean(),
});

export async function setConsent(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That consent change wasn't valid." };
  const { purpose, grant } = parsed.data;
  const state = grant ? "granted" : "revoked";

  const provider = await getDataProvider();
  const client = await provider.getClient(clientId);
  if (!client) return { ok: false, error: "Account not found." };

  if (process.env.DATA_PROVIDER === "db") {
    const db = getDb();
    const [existing] = await db
      .select({ version: consentsTable.version })
      .from(consentsTable)
      .where(and(eq(consentsTable.clientId, clientId), eq(consentsTable.purpose, purpose)))
      .limit(1);
    const version = grant ? (existing?.version ?? 0) + 1 : existing?.version ?? 1;
    await db
      .insert(consentsTable)
      .values({ orgId: client.orgId, clientId, purpose, state, version, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [consentsTable.clientId, consentsTable.purpose],
        set: { state, version, updatedAt: new Date() },
      });
  }

  await logAccess({
    action: "consent.change",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/consent:${purpose}`,
    reason: grant ? "grant" : "revoke",
  });
  return { ok: true };
}
