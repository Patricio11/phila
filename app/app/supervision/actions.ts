"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { counsellorIdForUser } from "@/db/queries/session-notes";
import { signOffNoteDb } from "@/db/queries/supervision";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Supervision sign-off. A supervisor reviews a supervisee's clinical note and either
 * signs it off or sends it back with feedback. Persisted to the note's supervisor
 * fields (only the note's author's supervisor may sign it); audited. `itemId` is the
 * note id.
 */
const input = z.object({
  itemId: z.string().min(1),
  superviseeId: z.string().min(1),
  decision: z.enum(["approved", "changes_requested"]),
  comment: z.string().max(2000).optional(),
});

export async function signOffNote(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Couldn't record the decision." };
  if (parsed.data.decision === "changes_requested" && !parsed.data.comment?.trim()) {
    return { ok: false, error: "Add a note on what to change before sending it back." };
  }

  if (isDb()) {
    const supId = await counsellorIdForUser(membership.orgId, principal.userId);
    if (!supId) return { ok: false, error: "Only a supervisor can sign off a note." };
    const res = await signOffNoteDb(membership.orgId, { noteId: parsed.data.itemId, supervisorCounsellorId: supId, decision: parsed.data.decision, comment: parsed.data.comment ?? null }, clockNow());
    if (!res.ok) return { ok: false, error: "That note isn't in your supervision queue." };
  }

  await logAccess({
    action: "note.read_hub_override",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `supervision:${parsed.data.itemId}/${parsed.data.superviseeId}`,
    reason: parsed.data.decision === "approved" ? "supervision_sign_off" : "supervision_changes_requested",
  });
  revalidatePath("/app/supervision");
  return { ok: true };
}
