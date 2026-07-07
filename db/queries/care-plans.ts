import "server-only";
import { eq } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { carePlans } from "@/db/schema";

/**
 * Care plans (W1.1)  the client-facing plan (summary + steps + resources), distinct
 * from the private session note. One per client. `care_plans` has no `org_id`  it's
 * RLS-scoped via `clients.org_id`, so every write runs inside `runForOrg` and the
 * child WITH CHECK rejects a plan whose client isn't in the caller's org.
 */
function rid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Share (or re-share) the care-plan summary with the client  stamps `sharedAt`. */
export async function shareCarePlanDb(
  orgId: string,
  input: { clientId: string; authorCounsellorId: string; summary: string },
  now: string,
): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const [existing] = await db.select().from(carePlans).where(eq(carePlans.clientId, input.clientId)).limit(1);
    if (existing) {
      await db.update(carePlans).set({ summary: input.summary, sharedAt: new Date(now) }).where(eq(carePlans.id, existing.id));
    } else {
      await db.insert(carePlans).values({
        id: rid("cp"), clientId: input.clientId, authorCounsellorId: input.authorCounsellorId,
        summary: input.summary, tasks: [], resources: [], nextStep: null, sharedAt: new Date(now),
      });
    }
  });
}

/** Append a between-session step (task) to the client's care plan. Returns its id. */
export async function addCarePlanStepDb(
  orgId: string,
  input: { clientId: string; authorCounsellorId: string; text: string },
): Promise<{ id: string }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const stepId = rid("step");
    const step = { id: stepId, text: input.text, done: false };
    const [existing] = await db.select().from(carePlans).where(eq(carePlans.clientId, input.clientId)).limit(1);
    if (existing) {
      await db.update(carePlans).set({ tasks: [...existing.tasks, step] }).where(eq(carePlans.id, existing.id));
    } else {
      await db.insert(carePlans).values({
        id: rid("cp"), clientId: input.clientId, authorCounsellorId: input.authorCounsellorId,
        summary: "", tasks: [step], resources: [], nextStep: null, sharedAt: null,
      });
    }
    return { id: stepId };
  });
}
