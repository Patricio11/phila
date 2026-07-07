"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { setPlatformFeatureDb } from "@/db/queries/features";
import { ORG_FEATURES } from "@/lib/domain/enums";

/**
 * Platform feature governance (W3.2) — the global kill-switch. Disabling a feature
 * here forces it OFF for every org, instantly, above their plan + own toggle.
 */
const input = z.object({ feature: z.enum(ORG_FEATURES), disabled: z.boolean() });

export async function setPlatformFeature(raw: z.infer<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  if (process.env.DATA_PROVIDER === "db") await setPlatformFeatureDb(parsed.data.feature, parsed.data.disabled);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: `platform:feature:${parsed.data.feature}`,
    reason: parsed.data.disabled ? "kill_feature" : "restore_feature",
  });
  revalidatePath("/admin/features");
  revalidatePath("/admin/orgs");
  return { ok: true };
}
