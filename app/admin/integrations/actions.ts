"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { getPlatformIntegration, savePlatformIntegration } from "@/db/queries/platform-integrations";
import { testPaystackKey } from "@/lib/payments/paystack";

/**
 * Super-admin configures Phila's own payment gateway (Paystack) for credit + plan
 * billing (Phase 15). The key is encrypted at rest and switched on here  never an
 * env var. A blank key field keeps the stored key (so you can toggle without
 * re-pasting). "Test connection" validates a key against Paystack before saving.
 */
const input = z.object({ secretKey: z.string().trim().default(""), enabled: z.boolean() });

async function resolveKey(provided: string): Promise<string> {
  if (provided) return provided;
  const existing = await getPlatformIntegration("paystack");
  return existing?.creds.secretKey ?? "";
}

export async function savePaystackConfig(raw: z.infer<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const secretKey = await resolveKey(parsed.data.secretKey);
  if (parsed.data.enabled && !secretKey) return { ok: false, error: "Add a secret key before switching it on." };

  await savePlatformIntegration("paystack", { secretKey }, parsed.data.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: "platform_integration:paystack", reason: parsed.data.enabled ? "enable_paystack" : "save_paystack" });
  return { ok: true };
}

export async function testPaystackConnection(raw: { secretKey: string }): Promise<{ ok: boolean; detail: string }> {
  await requireSuperAdmin();
  const key = await resolveKey((raw.secretKey ?? "").trim());
  return testPaystackKey(key);
}
