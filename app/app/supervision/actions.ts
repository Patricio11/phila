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

    // The supervisee hears about the decision straight away (batch 2).
    try {
      const { noteAuthorDb } = await import("@/db/queries/supervision");
      const { notifyCounsellor } = await import("@/db/queries/notifications");
      const author = await noteAuthorDb(membership.orgId, parsed.data.itemId);
      if (author) {
        await notifyCounsellor(author.counsellorId, {
          kind: "supervision_decision",
          title: parsed.data.decision === "approved"
            ? `Your note for ${author.clientName} was signed off`
            : `Changes requested on your note for ${author.clientName}`,
          body: parsed.data.decision === "approved"
            ? "Your supervisor approved it — nothing more to do."
            : `Your supervisor left feedback: “${(parsed.data.comment ?? "").slice(0, 140)}”`,
          href: "/app/supervision",
        });
      }
    } catch { /* a notification must never break the sign-off */ }
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

/* ---- Classroom stream (batch 2) ---- */

const postInput = z.object({ classId: z.string().min(1), body: z.string().trim().min(1, "Write something first.").max(3000) });

/** Post to a classroom stream (supervisor or member). Members are notified in-app. */
export async function postClassMessage(
  raw: z.infer<typeof postInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const parsed = postInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write something first." };

  if (isDb()) {
    const meId = await counsellorIdForUser(membership.orgId, principal.userId);
    if (!meId) return { ok: false, error: "Only counsellors can post here." };
    const { postToClassDb } = await import("@/db/queries/classrooms");
    const res = await postToClassDb(membership.orgId, parsed.data.classId, { userId: principal.userId, counsellorId: meId, name: principal.name }, parsed.data.body);
    if (!res.ok) return { ok: false, error: "You're not in this classroom." };

    // Everyone else in the class hears about it (bounded, best-effort).
    try {
      const { notifyCounsellor } = await import("@/db/queries/notifications");
      await Promise.allSettled((res.notifyCounsellorIds ?? []).map((cid) =>
        notifyCounsellor(cid, {
          kind: "class_post",
          title: `New post in ${res.className}`,
          body: `${principal.name.split(" ")[0]}: ${parsed.data.body.slice(0, 120)}`,
          href: "/app/supervision",
        }),
      ));
    } catch { /* notifications never break the post */ }
  }

  revalidatePath("/app/supervision");
  return { ok: true };
}
