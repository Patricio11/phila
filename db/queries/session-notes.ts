import "server-only";
import { and, eq } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { sessionNotes, counsellors } from "@/db/schema";
import type { SessionNote } from "@/lib/domain/types";

/**
 * Clinical session notes (W1.1). One note per appointment. `session_notes` has no
 * `org_id` — it's RLS-scoped via `appointments.org_id`, so every read/write here runs
 * inside `runForOrg` (the caller's org) and the child policy rejects a note whose
 * appointment isn't in that org. The note is the counsellor's private record; it is
 * never the shared care plan.
 */
function rid(): string {
  return `note_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

const toNote = (r: typeof sessionNotes.$inferSelect): SessionNote => ({
  id: r.id,
  appointmentId: r.appointmentId,
  authorCounsellorId: r.authorCounsellorId,
  body: r.body,
  aiGenerated: r.aiGenerated,
  signedAt: r.signedAt ? r.signedAt.toISOString() : null,
});

/** The note for an appointment, or null. Call inside a `runForOrg` (uses `activeDb`). */
export async function getSessionNoteDb(appointmentId: string): Promise<SessionNote | null> {
  const [r] = await activeDb().select().from(sessionNotes).where(eq(sessionNotes.appointmentId, appointmentId)).limit(1);
  return r ? toNote(r) : null;
}

/** Resolve the acting counsellor's record id from their user id, within the org. */
export async function counsellorIdForUser(orgId: string, userId: string): Promise<string | null> {
  return runForOrg(orgId, async () => {
    const [r] = await activeDb().select({ id: counsellors.id }).from(counsellors)
      .where(and(eq(counsellors.userId, userId), eq(counsellors.orgId, orgId))).limit(1);
    return r?.id ?? null;
  });
}

/**
 * Upsert the appointment's note (one per session). `sign: true` stamps `signedAt`;
 * a draft save leaves the existing signature untouched. RLS-scoped to the org.
 */
export async function saveSessionNoteDb(
  orgId: string,
  input: { appointmentId: string; authorCounsellorId: string; body: string; aiGenerated?: boolean; sign?: boolean },
  now: string,
): Promise<{ signedAt: string | null }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [existing] = await db.select().from(sessionNotes).where(eq(sessionNotes.appointmentId, input.appointmentId)).limit(1);
    const signedAt = input.sign ? new Date(now) : (existing?.signedAt ?? null);
    if (existing) {
      await db.update(sessionNotes)
        .set({ body: input.body, aiGenerated: input.aiGenerated ?? existing.aiGenerated, signedAt })
        .where(eq(sessionNotes.id, existing.id));
    } else {
      await db.insert(sessionNotes).values({
        id: rid(), appointmentId: input.appointmentId, authorCounsellorId: input.authorCounsellorId,
        body: input.body, aiGenerated: input.aiGenerated ?? false, signedAt,
      });
    }
    return { signedAt: signedAt ? signedAt.toISOString() : null };
  });
}
