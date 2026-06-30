"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { HubInsights } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";

const input = z.object({
  period: z.enum(["week", "month", "quarter"]).optional(),
  province: z.string().optional(),
  gender: z.string().optional(),
  ageBand: z.string().optional(),
});

/** Recompute Hub insights for a filter set. Audited  demographic cuts are PII. */
export async function runInsights(raw: z.infer<typeof input>): Promise<HubInsights> {
  const { principal, membership } = await requireHub();
  const filters = input.parse(raw);
  const provider = await getDataProvider();

  await logAccess({
    action: "demographics.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/insights`,
    reason: "filter_insights",
  });

  return provider.getHubInsights(membership.orgId, clockNow(), filters);
}
