"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { savePlatformIntegration } from "@/db/queries/platform-integrations";

/**
 * Show/hide the pricing tiers on the public landing page. Stored as a platform
 * switch (`platform_integrations` key `landing_pricing`, the `enabled` flag);
 * default off, so pricing stays hidden until it's finalised. Toggling revalidates
 * the landing for an immediate update.
 */
export async function setLandingPricing(on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  // Empty creds — this key is purely a switch; `enabled` carries the state.
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
