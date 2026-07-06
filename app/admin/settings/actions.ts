"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { savePlatformVatDb } from "@/db/queries/settings";

/**
 * Platform VAT (mock). National rate, so one super-admin change applies to every
 * org's invoices and reporting. Validated + audited; Phase 10 persists it to the
 * platform config and stamps an effective date.
 */
const input = z.object({
  vatRatePercent: z.number().min(0, "VAT can't be negative.").max(28, "That VAT rate looks too high."),
});

export async function savePlatformVat(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid VAT rate." };

  if (process.env.DATA_PROVIDER === "db") {
    await savePlatformVatDb(parsed.data.vatRatePercent);
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: "platform:vat_rate",
    reason: "update_platform_vat",
  });
  // VAT flows into every org's invoices + reporting.
  revalidatePath("/admin/settings");
  revalidatePath("/hub/invoicing");
  return { ok: true };
}
