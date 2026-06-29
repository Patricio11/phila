"use server";

import { z } from "zod";
import { requireClient } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { toggleStep as persistToggleStep } from "@/db/queries/settings";

/**
 * A client ticks a between-session step done (or undone). Mock: validated +
 * audited; the optimistic UI holds the state. Phase 11 persists to the care
 * plan task and notifies the counsellor. Gentle by design  encouragement,
 * never pressure (Safeguarding / care ethic).
 */
const input = z.object({
  taskId: z.string().min(1),
  done: z.boolean(),
});

export async function toggleStep(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, clientId } = await requireClient();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Couldn't update that step." };
  if (process.env.DATA_PROVIDER === "db") await persistToggleStep(clientId, parsed.data.taskId, parsed.data.done);
  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: null,
    target: `client:${clientId}/step:${parsed.data.taskId}`,
    reason: parsed.data.done ? "complete_step" : "uncomplete_step",
  });
  return { ok: true };
}
