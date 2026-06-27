"use server";

import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Supervision sign-off (mock). A supervisor reviews a supervisee's clinical
 * note and either signs it off or sends it back with feedback. Validated +
 * audited; the note's provenance stays honest (who wrote it, who signed it).
 * Phase 11 persists the decision + comment to the note record.
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

  await logAccess({
    action: "note.read_hub_override",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `supervision:${parsed.data.itemId}/${parsed.data.superviseeId}`,
    reason: parsed.data.decision === "approved" ? "supervision_sign_off" : "supervision_changes_requested",
  });
  return { ok: true };
}
