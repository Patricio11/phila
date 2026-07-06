"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveOnboardingRequirementsDb } from "@/db/queries/platform";

/**
 * Configure the onboarding document requirements every new practice must meet
 * (mock). Validated + audited; Phase 10 persists to a platform-config table the
 * onboarding wizard reads. The platform admin owns this gate.
 */
const input = z.object({
  requirements: z
    .array(z.object({ id: z.string().min(1), label: z.string().min(2), description: z.string().max(300), required: z.boolean() }))
    .max(30),
});

export async function saveOnboardingRequirements(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the requirements." };

  if (process.env.DATA_PROVIDER === "db") {
    await saveOnboardingRequirementsDb(parsed.data.requirements);
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: "platform:onboarding_requirements",
    reason: "update_onboarding_requirements",
  });
  revalidatePath("/admin/onboarding");
  return { ok: true };
}
