"use server";

import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/** Exporting the platform audit ledger is itself an audited action — for real. */
export async function auditLedgerExport(
  raw: { format: string; count: number },
): Promise<{ ok: true }> {
  const principal = await requireSuperAdmin();
  await logAccess({
    action: "pii.export",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: `platform:audit_ledger.${raw?.format}`,
    reason: `audit_export_${raw?.format}:${Math.max(0, Math.floor(raw?.count ?? 0))}`,
  });
  return { ok: true };
}
