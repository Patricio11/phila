"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { getOrgGatewayCreds, saveOrgGateway } from "@/db/queries/org-gateway";
import { testPaystackKey } from "@/lib/payments/paystack";

/**
 * The org connects its OWN payment gateway (Phase 15B) so clients pay it directly.
 * Paystack first; the key is encrypted at rest. A blank key keeps the stored one.
 */
const input = z.object({ provider: z.literal("paystack"), secretKey: z.string().trim().default(""), enabled: z.boolean() });

async function resolveKey(orgId: string, provided: string): Promise<string> {
  if (provided) return provided;
  return (await getOrgGatewayCreds(orgId)).secretKey ?? "";
}

export async function saveOrgGatewayConfig(raw: z.infer<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  const secretKey = await resolveKey(membership.orgId, parsed.data.secretKey);
  if (parsed.data.enabled && !secretKey) return { ok: false, error: "Add your Paystack secret key first." };

  await saveOrgGateway(membership.orgId, "paystack", { secretKey }, parsed.data.enabled);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/gateway:paystack`, reason: parsed.data.enabled ? "gateway_enabled" : "gateway_saved" });
  return { ok: true };
}

export async function testOrgGatewayConnection(raw: { secretKey: string }): Promise<{ ok: boolean; detail: string }> {
  const { membership } = await requireHub();
  const key = await resolveKey(membership.orgId, (raw.secretKey ?? "").trim());
  return testPaystackKey(key);
}
