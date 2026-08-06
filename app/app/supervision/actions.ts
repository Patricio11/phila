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
            ? "Your supervisor approved it - nothing more to do."
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

/* ---- Live class sessions + attendance (batch 2b) ---- */

const sessionInput = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(2, "Give the session a title.").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(15).max(480),
  mode: z.enum(["online", "in_person"]),
  location: z.string().trim().max(160).optional(),
});

/** Schedule a class meeting. Everyone gets the link (in-app) + it lands on the stream. */
export async function scheduleClassSession(
  raw: z.infer<typeof sessionInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor", "org_admin"]);
  const parsed = sessionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the session details." };
  const d = parsed.data;

  if (isDb()) {
    const { scheduleClassSessionDb, postToClassDb } = await import("@/db/queries/classrooms");
    const startsAt = new Date(`${d.date}T${d.time}:00+02:00`); // SAST wall clock
    const res = await scheduleClassSessionDb(membership.orgId, {
      classId: d.classId, title: d.title, startsAt, durationMin: d.durationMin,
      mode: d.mode, location: d.location || null, createdByUserId: principal.userId,
    });
    if (!res.ok) return { ok: false, error: "That classroom couldn't be found." };

    const whenLabel = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(startsAt);
    // The stream carries the announcement; online sessions carry the join line.
    const meId = await counsellorIdForUser(membership.orgId, principal.userId);
    if (meId) {
      await postToClassDb(membership.orgId, d.classId, { userId: principal.userId, counsellorId: meId, name: principal.name },
        `📅 ${d.title} - ${whenLabel} · ${d.durationMin} min · ${d.mode === "online" ? "online (join from this page when it's time)" : (d.location || "in person")}`);
    }
    try {
      const { notifyCounsellor } = await import("@/db/queries/notifications");
      await Promise.allSettled((res.notifyCounsellorIds ?? []).filter((id) => id !== meId).map((cid) =>
        notifyCounsellor(cid, {
          kind: "class_session",
          title: `Class session: ${d.title}`,
          body: `${res.className} · ${whenLabel} · ${d.mode === "online" ? "online - the join link is on your Supervision page" : (d.location || "in person")}`,
          href: "/app/supervision",
        }),
      ));
    } catch { /* never break scheduling */ }
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `classroom:${d.classId}/session`,
    reason: "schedule_class_session",
  });
  revalidatePath("/app/supervision");
  return { ok: true };
}

const attendanceInput = z.object({
  sessionId: z.string().min(1),
  marks: z.array(z.object({ counsellorId: z.string().min(1), status: z.enum(["present", "absent"]) })).max(100),
});

/** The register: the supervisor marks who attended. Kept permanently (CPD evidence). */
export async function markClassAttendance(
  raw: z.infer<typeof attendanceInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor", "org_admin"]);
  const parsed = attendanceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the register." };

  if (isDb()) {
    const { markAttendanceDb } = await import("@/db/queries/classrooms");
    const ok = await markAttendanceDb(membership.orgId, parsed.data.sessionId, parsed.data.marks);
    if (!ok) return { ok: false, error: "That session couldn't be found." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `class_session:${parsed.data.sessionId}/attendance`,
    reason: `mark_attendance:${parsed.data.marks.filter((m) => m.status === "present").length}p_${parsed.data.marks.filter((m) => m.status === "absent").length}a`,
  });
  revalidatePath("/app/supervision");
  return { ok: true };
}

/* ---- Fix what you wrote (batch 2d): edit/delete your OWN posts ---- */

const editPostInput = z.object({ postId: z.string().min(1), body: z.string().trim().min(1, "Write something first.").max(3000) });

export async function editClassPost(
  raw: z.infer<typeof editPostInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const parsed = editPostInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write something first." };
  if (isDb()) {
    const { updateClassPostDb } = await import("@/db/queries/classrooms");
    const ok = await updateClassPostDb(membership.orgId, parsed.data.postId, principal.userId, parsed.data.body);
    if (!ok) return { ok: false, error: "You can only edit your own posts." };
  }
  revalidatePath("/app/supervision");
  return { ok: true };
}

export async function deleteClassPost(
  raw: { postId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  if (!raw?.postId) return { ok: false, error: "Invalid post." };
  if (isDb()) {
    const { deleteClassPostDb } = await import("@/db/queries/classrooms");
    const ok = await deleteClassPostDb(membership.orgId, raw.postId, principal.userId);
    if (!ok) return { ok: false, error: "You can only delete your own posts." };
  }
  revalidatePath("/app/supervision");
  return { ok: true };
}
