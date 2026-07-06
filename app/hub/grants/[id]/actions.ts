"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { getGrantOrgId, postGrantNarrativeDb } from "@/db/queries/grants";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Grant actions. Narrative updates and the period export are the funder-facing
 * outputs; the export is k-anon (the floor is applied in the provider) and
 * audited. Mock in Part A; Phase 16 persists narratives + generates the real
 * templated report.
 */
const narrativeInput = z.object({
  grantId: z.string().min(1),
  body: z.string().min(1, "Write an update before posting."),
});

export interface PostedNarrative {
  id: string;
  author: string;
  body: string;
  postedAt: string;
}

export async function postNarrative(
  raw: z.infer<typeof narrativeInput>,
): Promise<{ ok: true; narrative: PostedNarrative } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = narrativeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Cannot post" };

  if (isDb()) {
    const owner = await getGrantOrgId(parsed.data.grantId);
    if (owner !== membership.orgId) return { ok: false, error: "Grant not found." };
    await postGrantNarrativeDb(parsed.data.grantId, principal.name, parsed.data.body);
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `grant:${parsed.data.grantId}/narrative`,
    reason: "post_narrative",
  });

  return {
    ok: true,
    narrative: { id: `n_${parsed.data.grantId}_${parsed.data.body.length}`, author: principal.name, body: parsed.data.body, postedAt: clockNow() },
  };
}

const exportInput = z.object({ grantId: z.string().min(1), format: z.enum(["pdf", "csv"]) });

export async function exportGrantReport(
  raw: z.infer<typeof exportInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = exportInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid export request." };

  // Confirm the grant belongs to this org BEFORE we log a pii.export against it —
  // no cross-org export, and no spurious audit entry for someone else's grant.
  if (isDb()) {
    const owner = await getGrantOrgId(parsed.data.grantId);
    if (owner !== membership.orgId) return { ok: false, error: "Grant not found." };
  }

  await logAccess({
    action: "pii.export",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `grant:${parsed.data.grantId}/report.${parsed.data.format}`,
    reason: "funder_report_k_anon",
  });
  return { ok: true };
}
