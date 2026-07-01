import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { clients, counsellors, forms, formAssignments, orgs } from "@/db/schema";
import type { Form, FormField, FormSnapshot, FormTheme } from "@/lib/domain/types";
import type {
  ClientFormRow,
  FormDraft,
  FormResponseRow,
  FormResponses,
  FormSummary,
  FormTokenView,
} from "@/lib/data-provider";
import type { FormAssignmentStatus, FormKind, FormStatus } from "@/lib/domain/enums";

/* ── Row → domain mappers ──────────────────────────────────────────────── */

function toForm(r: typeof forms.$inferSelect): Form {
  return {
    id: r.id, orgId: r.orgId, kind: r.kind as FormKind, title: r.title,
    intro: r.intro ?? undefined, fields: r.fields as FormField[], status: r.status as FormStatus,
    theme: (r.theme as FormTheme | null) ?? null, shareToken: r.shareToken, shareEnabled: r.shareEnabled,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function toSnapshot(v: unknown): FormSnapshot {
  const s = (v ?? {}) as Partial<FormSnapshot>;
  return { kind: (s.kind ?? "custom") as FormKind, title: s.title ?? "Form", intro: s.intro, fields: (s.fields ?? []) as FormField[] };
}

function snapshotOf(f: Pick<Form, "kind" | "title" | "intro" | "fields">): FormSnapshot {
  return { kind: f.kind, title: f.title, intro: f.intro, fields: f.fields };
}

const token = () => `f_${randomUUID().replace(/-/g, "")}`;

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function listFormsDb(orgId: string): Promise<FormSummary[]> {
  const db = getDb();
  const rows = await db.select().from(forms).where(eq(forms.orgId, orgId));
  const ids = rows.map((r) => r.id);
  const sends = ids.length
    ? await db.select().from(formAssignments).where(and(eq(formAssignments.orgId, orgId), inArray(formAssignments.formId, ids)))
    : [];
  return rows
    .map((r): FormSummary => {
      const mine = sends.filter((a) => a.formId === r.id && a.status !== "revoked");
      return {
        id: r.id, kind: r.kind as FormKind, title: r.title, intro: r.intro ?? undefined,
        fieldCount: (r.fields as FormField[]).length, status: r.status as FormStatus,
        sentCount: mine.length, completedCount: mine.filter((a) => a.status === "completed").length,
        updatedAt: r.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getFormDb(orgId: string, formId: string): Promise<Form | null> {
  const [r] = await getDb().select().from(forms).where(and(eq(forms.id, formId), eq(forms.orgId, orgId))).limit(1);
  return r ? toForm(r) : null;
}

/** The org's active intake form  drives booking. */
export async function getActiveIntakeFormDb(orgId: string): Promise<Form | null> {
  const [r] = await getDb().select().from(forms)
    .where(and(eq(forms.orgId, orgId), eq(forms.kind, "intake"), eq(forms.status, "active")))
    .orderBy(desc(forms.updatedAt)).limit(1);
  return r ? toForm(r) : null;
}

export async function getFormResponsesDb(orgId: string, formId: string): Promise<FormResponses | null> {
  const db = getDb();
  const form = await getFormDb(orgId, formId);
  if (!form) return null;
  const [assigns, orgClients, orgCounsellors] = await Promise.all([
    db.select().from(formAssignments).where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.formId, formId))),
    db.select({ id: clients.id, name: clients.name, primaryCounsellorId: clients.primaryCounsellorId }).from(clients).where(eq(clients.orgId, orgId)),
    db.select({ id: counsellors.id, name: counsellors.name }).from(counsellors).where(eq(counsellors.orgId, orgId)),
  ]);
  const rows: FormResponseRow[] = assigns
    .filter((a) => a.status !== "revoked")
    .map((a) => {
      const client = a.clientId ? orgClients.find((c) => c.id === a.clientId) : undefined;
      const clientName = client?.name ?? a.respondentName ?? "From share link";
      return {
        assignmentId: a.id, clientId: a.clientId ?? "", clientName,
        counsellorName: client ? (orgCounsellors.find((c) => c.id === client.primaryCounsellorId)?.name ?? "Unassigned") : "Shared link",
        status: a.status as FormAssignmentStatus, sentAt: a.sentAt.toISOString(),
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
        answers: (a.answers as Record<string, string> | null) ?? null, snapshot: toSnapshot(a.snapshot),
      };
    })
    .sort((x, y) => (y.submittedAt ?? y.sentAt).localeCompare(x.submittedAt ?? x.sentAt));
  return { form, rows };
}

async function orgName(orgId: string): Promise<string> {
  const [org] = await getDb().select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return org?.name ?? "Your practice";
}

/** Public fill page  resolved by an assignment token OR an open share token. */
export async function getFormByTokenDb(tok: string): Promise<FormTokenView | null> {
  const db = getDb();
  // 1) A per-client assignment link.
  const [a] = await db.select().from(formAssignments).where(eq(formAssignments.token, tok)).limit(1);
  if (a && a.status !== "revoked") {
    const form = await getFormDb(a.orgId, a.formId);
    return {
      assignmentId: a.id, formId: a.formId, orgId: a.orgId, orgName: await orgName(a.orgId), mode: "assignment",
      status: a.status as FormAssignmentStatus, snapshot: toSnapshot(a.snapshot), theme: form?.theme ?? null,
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
    };
  }
  // 2) An open share link (form-level, still fillable each time).
  const [f] = await db.select().from(forms).where(eq(forms.shareToken, tok)).limit(1);
  if (f && f.shareEnabled && f.status === "active") {
    const form = toForm(f);
    return {
      assignmentId: null, formId: form.id, orgId: form.orgId, orgName: await orgName(form.orgId), mode: "share",
      status: "sent", snapshot: snapshotOf(form), theme: form.theme ?? null, submittedAt: null,
    };
  }
  return null;
}

/** Enable/disable the open share link (mints a token on first enable). */
export async function setFormShareDb(orgId: string, formId: string, enabled: boolean, now: string): Promise<{ shareToken: string | null; shareEnabled: boolean } | null> {
  const db = getDb();
  const form = await getFormDb(orgId, formId);
  if (!form) return null;
  const shareToken = form.shareToken ?? (enabled ? `s_${randomUUID().replace(/-/g, "")}` : null);
  await db.update(forms).set({ shareToken, shareEnabled: enabled, updatedAt: new Date(now) })
    .where(and(eq(forms.id, formId), eq(forms.orgId, orgId)));
  return { shareToken, shareEnabled: enabled };
}

export async function listClientFormsDb(clientId: string): Promise<ClientFormRow[]> {
  const rows = await getDb().select().from(formAssignments).where(eq(formAssignments.clientId, clientId));
  return rows
    .filter((a) => a.status !== "revoked")
    .map((a): ClientFormRow => {
      const snap = toSnapshot(a.snapshot);
      return { assignmentId: a.id, token: a.token, formTitle: snap.title, kind: snap.kind, status: a.status as FormAssignmentStatus, sentAt: a.sentAt.toISOString(), submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null };
    })
    .sort((x, y) => y.sentAt.localeCompare(x.sentAt));
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export async function createFormDb(orgId: string, draft: FormDraft, createdBy: string, now: string): Promise<{ id: string }> {
  const id = `form_${randomUUID().slice(0, 12)}`;
  const at = new Date(now);
  await getDb().insert(forms).values({
    id, orgId, kind: draft.kind, title: draft.title, intro: draft.intro ?? null,
    fields: draft.fields, theme: draft.theme ?? null, status: "active", createdBy, createdAt: at, updatedAt: at,
  });
  return { id };
}

export async function updateFormDb(orgId: string, formId: string, draft: FormDraft, now: string): Promise<{ ok: boolean }> {
  const res = await getDb().update(forms)
    .set({ kind: draft.kind, title: draft.title, intro: draft.intro ?? null, fields: draft.fields, theme: draft.theme ?? null, updatedAt: new Date(now) })
    .where(and(eq(forms.id, formId), eq(forms.orgId, orgId))).returning({ id: forms.id });
  return { ok: res.length > 0 };
}

export async function duplicateFormDb(orgId: string, formId: string, now: string): Promise<{ id: string } | null> {
  const form = await getFormDb(orgId, formId);
  if (!form) return null;
  return createFormDb(orgId, { kind: form.kind === "intake" ? "custom" : form.kind, title: `${form.title} (copy)`, intro: form.intro, fields: form.fields.map((f) => ({ ...f })) }, form.orgId, now);
}

export async function setFormStatusDb(orgId: string, formId: string, status: FormStatus, now: string): Promise<{ ok: boolean }> {
  const res = await getDb().update(forms).set({ status, updatedAt: new Date(now) })
    .where(and(eq(forms.id, formId), eq(forms.orgId, orgId))).returning({ id: forms.id });
  return { ok: res.length > 0 };
}

export async function sendFormToClientsDb(orgId: string, formId: string, clientIds: string[], sentBy: string, now: string): Promise<{ sent: number; assignments: { clientId: string; token: string }[] }> {
  const db = getDb();
  const form = await getFormDb(orgId, formId);
  if (!form) return { sent: 0, assignments: [] };
  const snapshot = snapshotOf(form);
  const at = new Date(now);
  const existing = await db.select().from(formAssignments)
    .where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.formId, formId), inArray(formAssignments.clientId, clientIds.length ? clientIds : [""])));
  const out: { clientId: string; token: string }[] = [];
  for (const clientId of clientIds) {
    const reuse = existing.find((a) => a.clientId === clientId && a.status === "sent");
    if (reuse) {
      await db.update(formAssignments).set({ snapshot, sentAt: at, sentBy }).where(eq(formAssignments.id, reuse.id));
      out.push({ clientId, token: reuse.token });
    } else {
      const tok = token();
      await db.insert(formAssignments).values({ id: `fa_${randomUUID().slice(0, 12)}`, orgId, formId, clientId, token: tok, status: "sent", snapshot, answers: null, sentBy, sentAt: at, submittedAt: null });
      out.push({ clientId, token: tok });
    }
  }
  return { sent: out.length, assignments: out };
}

/** Best-effort respondent name for an open submission (a field that looks like a name). */
function respondentNameFrom(snapshot: FormSnapshot, answers: Record<string, string>): string | null {
  const nameField = snapshot.fields.find((f) => /name/i.test(f.label) || /name/i.test(f.id));
  const v = nameField ? (answers[nameField.id] ?? "").trim() : "";
  return v || null;
}

/**
 * Mirror a completed booking intake into a `form_assignments` row against the org's
 * active intake form, so intake answers captured at booking also appear in the
 * form's Responses view. Best-effort  callers must not let this break booking.
 */
export async function recordBookingIntakeDb(orgId: string, clientId: string, answers: Record<string, string>, now: string): Promise<void> {
  const form = await getActiveIntakeFormDb(orgId);
  if (!form) return;
  const at = new Date(now);
  await getDb().insert(formAssignments).values({
    id: `fa_${randomUUID().slice(0, 12)}`, orgId, formId: form.id, clientId,
    token: `r_${randomUUID().replace(/-/g, "")}`, status: "completed",
    snapshot: snapshotOf(form), answers, sentBy: null, sentAt: at, submittedAt: at,
  });
}

export async function submitFormResponseDb(tok: string, answers: Record<string, string>, now: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const at = new Date(now);
  // 1) A per-client assignment link  fill it in place.
  const [a] = await db.select().from(formAssignments).where(eq(formAssignments.token, tok)).limit(1);
  if (a) {
    if (a.status === "revoked") return { ok: false, error: "This form link is no longer valid." };
    if (a.status === "completed") return { ok: false, error: "This form has already been submitted." };
    await db.update(formAssignments).set({ answers, status: "completed", submittedAt: at }).where(eq(formAssignments.id, a.id));
    return { ok: true };
  }
  // 2) An open share link  each submission is a fresh response row.
  const [f] = await db.select().from(forms).where(eq(forms.shareToken, tok)).limit(1);
  if (!f || !f.shareEnabled || f.status !== "active") return { ok: false, error: "This form link is no longer valid." };
  const snapshot = snapshotOf(toForm(f));
  await db.insert(formAssignments).values({
    id: `fa_${randomUUID().slice(0, 12)}`, orgId: f.orgId, formId: f.id, clientId: null,
    respondentName: respondentNameFrom(snapshot, answers), token: `r_${randomUUID().replace(/-/g, "")}`,
    status: "completed", snapshot, answers, sentBy: null, sentAt: at, submittedAt: at,
  });
  return { ok: true };
}
