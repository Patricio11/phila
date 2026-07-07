import "server-only";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { outcomeMeasures } from "@/db/schema";

/**
 * Outcome measures (PHQ-9 / GAD-7). Persisted per client; the counsellor dashboard
 * and reporting read these back for the trend + improvement rate. `outcome_measures`
 * has no `org_id`  it's RLS-scoped via `clients.org_id`, so `runForOrg` makes the
 * WITH CHECK reject an insert whose client isn't in the caller's org.
 */
function rid(): string {
  return `om_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function createOutcomeMeasureDb(
  orgId: string,
  input: { clientId: string; tool: "PHQ-9" | "GAD-7"; score: number },
  now: string,
): Promise<{ id: string }> {
  const id = rid();
  await runForOrg(orgId, () =>
    activeDb().insert(outcomeMeasures).values({ id, clientId: input.clientId, tool: input.tool, score: input.score, takenAt: new Date(now) }),
  );
  return { id };
}
