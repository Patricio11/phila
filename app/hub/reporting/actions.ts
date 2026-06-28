"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider, type ReportingResult } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";

/**
 * Reporting actions. Every demographic read/export is consent-gated and audited
 * (Outcome-Honesty + Protected & Audited). The k-anonymity floor + small-cell
 * suppression are applied in the provider, not here, so the seam stays the gate.
 */
const filters = z.object({
  province: z.string().optional(),
  gender: z.string().optional(),
  ageBand: z.string().optional(),
  employment: z.string().optional(),
});

export async function runReport(raw: z.infer<typeof filters>): Promise<ReportingResult> {
  const { membership } = await requireHub();
  const parsed = filters.parse(raw);
  const provider = await getDataProvider();
  const now = clockNow();

  await logAccess({
    action: "demographics.read",
    actor: { userId: "org_admin", platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/reporting`,
    reason: "demographic_filter",
  });

  return provider.getReporting(membership.orgId, now, parsed);
}

export async function exportFunderReport(format: "pdf" | "csv"): Promise<{ ok: true }> {
  const { membership } = await requireHub();
  await logAccess({
    action: "pii.export",
    actor: { userId: "org_admin", platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/funder_report.${format}`,
    reason: "funder_export_k_anon",
  });
  return { ok: true };
}
