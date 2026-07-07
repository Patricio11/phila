"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { savePlatformIntegration } from "@/db/queries/platform-integrations";
import { savePlanDb } from "@/db/queries/plans";
import { planById } from "@/lib/billing/plans";

/**
 * Show/hide the pricing tiers on the public landing page. Stored as a platform
 * switch (`platform_integrations` key `landing_pricing`, the `enabled` flag);
 * default off, so pricing stays hidden until it's finalised. Toggling revalidates
 * the landing for an immediate update.
 */
export async function setLandingPricing(on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  // Empty creds  this key is purely a switch; `enabled` carries the state.
  await savePlatformIntegration("landing_pricing", {}, on);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: "platform:landing_pricing",
    reason: on ? "show_landing_pricing" : "hide_landing_pricing",
  });
  revalidatePath("/");
  revalidatePath("/admin/plans");
  return { ok: true };
}

const planInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(40),
  tagline: z.string().trim().max(120),
  priceCents: z.number().int().min(0).max(100_000_00),
  seats: z.number().int().min(1).max(100000).nullable(),
  aiTokens: z.number().int().min(0).max(100_000_000),
  videoMinutes: z.number().int().min(0).max(1_000_000),
  messaging: z.boolean(),
  rooms: z.number().int().min(0).max(100000).nullable(),
  storageGb: z.number().int().min(1).max(100000),
  popular: z.boolean().optional(),
  ngo: z.boolean().optional(),
});

/** Edit a plan's price, quotas, and entitlements (W3.4). One change → every org on the plan. */
export async function savePlan(raw: z.infer<typeof planInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the plan details." };
  // Only editing existing plans for now (ids are stable, referenced by subscriptions).
  if (!planById(parsed.data.id)) return { ok: false, error: "Unknown plan." };

  if (process.env.DATA_PROVIDER === "db") await savePlanDb(parsed.data);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `plan:${parsed.data.id}`, reason: "update_plan" });
  revalidatePath("/admin/plans");
  revalidatePath("/"); // landing pricing
  return { ok: true };
}
