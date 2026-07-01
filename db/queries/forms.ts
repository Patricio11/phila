import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { clients, counsellors, forms, formAssignments, orgs } from "@/db/schema";
import type { Form, FormField, FormSnapshot } from "@/lib/domain/types";
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
      const client = orgClients.find((c) => c.id === a.clientId);
      return {
        assignmentId: a.id, clientId: a.clientId, clientName: client?.name ?? "Client",
        counsellorName: orgCounsellors.find((c) => c.id === client?.primaryCounsellorId)?.name ?? "Unassigned",
        status: a.status as FormAssignmentStatus, sentAt: a.sentAt.toISOString(),
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
        answers: (a.answers as Record<string, string> | null) ?? null, snapshot: toSnapshot(a.snapshot),
      };
    })
    .sort((x, y) => (y.submittedAt ?? y.sentAt).localeCompare(x.submittedAt ?? x.sentAt));
  return { form, rows };
}

/** Public fill page  resolved by token, no org session. */
export async function getFormByTokenDb(tok: string): Promise<FormTokenView | null> {
  const db = getDb();
  const [a] = await db.select().from(formAssignments).where(eq(formAssignments.token, tok)).limit(1);
  if (!a || a.status === "revoked") return null;
  const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, a.orgId)).limit(1);
  return {
    assignmentId: a.id, orgId: a.orgId, orgName: org?.name ?? "Your practice",
    status: a.status as FormAssignmentStatus, snapshot: toSnapshot(a.snapshot),
    submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
  };
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
    fields: draft.fields, status: "active", createdBy, createdAt: at, updatedAt: at,
  });
  return { id };
}

export async function updateFormDb(orgId: string, formId: string, draft: FormDraft, now: string): Promise<{ ok: boolean }> {
  const res = await getDb().update(forms)
    .set({ kind: draft.kind, title: draft.title, intro: draft.intro ?? null, fields: draft.fields, updatedAt: new Date(now) })
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

export async function submitFormResponseDb(tok: string, answers: Record<string, string>, now: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const [a] = await db.select().from(formAssignments).where(eq(formAssignments.token, tok)).limit(1);
  if (!a || a.status === "revoked") return { ok: false, error: "This form link is no longer valid." };
  if (a.status === "completed") return { ok: false, error: "This form has already been submitted." };
  await db.update(formAssignments).set({ answers, status: "completed", submittedAt: new Date(now) }).where(eq(formAssignments.id, a.id));
  return { ok: true };
}
