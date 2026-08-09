import "server-only";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { formAutomations, forms, formAssignments, appointments, clients, counsellors } from "@/db/schema";
import { sendFormToClientsDb } from "@/db/queries/forms";

/**
 * Batch 2l - form automations. The practice says "send this form when X
 * happens" and the system does it, once. Triggers:
 *   on_booking      - an appointment was created (optionally first booking only)
 *   after_attended  - the client's Nth session was marked held
 *
 * Idempotence is structural: a form is never sent to the same client twice by
 * automation - we check for an existing assignment of that form to that client.
 */

export type AutomationTrigger = "on_booking" | "after_attended";

export interface AutomationView {
  id: string;
  formId: string;
  formTitle: string;
  trigger: AutomationTrigger;
  threshold: number | null;
  firstBookingOnly: boolean;
  active: boolean;
}

const HELD = ["completed", "discharged"];

export async function listAutomationsDb(orgId: string): Promise<AutomationView[]> {
  return runForOrg(orgId, async () => {
    const rows = await activeDb()
      .select({ a: formAutomations, title: forms.title })
      .from(formAutomations)
      .leftJoin(forms, eq(formAutomations.formId, forms.id))
      .where(eq(formAutomations.orgId, orgId));
    return rows.map((r) => ({
      id: r.a.id, formId: r.a.formId, formTitle: r.title ?? "Form",
      trigger: r.a.trigger as AutomationTrigger, threshold: r.a.threshold,
      firstBookingOnly: r.a.firstBookingOnly, active: r.a.active,
    }));
  });
}

export async function createAutomationDb(orgId: string, input: { formId: string; trigger: AutomationTrigger; threshold: number | null; firstBookingOnly: boolean; createdBy: string }): Promise<string> {
  return runForOrg(orgId, async () => {
    const [row] = await activeDb().insert(formAutomations).values({
      orgId, formId: input.formId, trigger: input.trigger,
      threshold: input.trigger === "after_attended" ? input.threshold ?? 1 : null,
      firstBookingOnly: input.trigger === "on_booking" ? input.firstBookingOnly : false,
      createdBy: input.createdBy,
    }).returning({ id: formAutomations.id });
    return row!.id;
  });
}

export async function deleteAutomationDb(orgId: string, id: string): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().delete(formAutomations)
      .where(and(eq(formAutomations.id, id), eq(formAutomations.orgId, orgId)))
      .returning({ id: formAutomations.id });
    return res.length > 0;
  });
}

export async function setAutomationActiveDb(orgId: string, id: string, active: boolean): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(formAutomations).set({ active })
      .where(and(eq(formAutomations.id, id), eq(formAutomations.orgId, orgId)))
      .returning({ id: formAutomations.id });
    return res.length > 0;
  });
}

/** Has this form already gone to this client (any channel)? Keeps automation once-only. */
async function alreadySent(formId: string, clientId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: formAssignments.id }).from(formAssignments)
    .where(and(eq(formAssignments.formId, formId), eq(formAssignments.clientId, clientId))).limit(1);
  return Boolean(row);
}

/** How many sessions this client has actually attended. */
async function attendedCount(orgId: string, clientId: string): Promise<number> {
  const rows = await getDb().select({ state: appointments.state }).from(appointments)
    .where(and(eq(appointments.orgId, orgId), eq(appointments.clientId, clientId)));
  return rows.filter((r) => HELD.includes(r.state)).length;
}

/** Bookings this client has (any state) - "first booking only" needs this. */
async function bookingCount(orgId: string, clientId: string): Promise<number> {
  const rows = await getDb().select({ id: appointments.id }).from(appointments)
    .where(and(eq(appointments.orgId, orgId), eq(appointments.clientId, clientId), ne(appointments.state, "cancelled")));
  return rows.length;
}

/**
 * Run every matching automation for a client. Called after a booking is created
 * and after a session is marked held. Best-effort and silent: an automation must
 * never break the booking or the session it rides on.
 */
export async function runFormAutomations(
  orgId: string,
  clientId: string,
  trigger: AutomationTrigger,
  sentBy: string,
  nowISO: string,
): Promise<{ sent: { formId: string; title: string; token: string }[] }> {
  const sent: { formId: string; title: string; token: string }[] = [];
  try {
    const db = getDb();
    const autos = await db.select({ a: formAutomations, title: forms.title, status: forms.status })
      .from(formAutomations)
      .leftJoin(forms, eq(formAutomations.formId, forms.id))
      .where(and(eq(formAutomations.orgId, orgId), eq(formAutomations.trigger, trigger), eq(formAutomations.active, true)));
    if (autos.length === 0) return { sent };

    const [client] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId), isNull(clients.deletedAt))).limit(1);
    if (!client) return { sent };

    const attended = trigger === "after_attended" ? await attendedCount(orgId, clientId) : 0;
    const bookings = trigger === "on_booking" ? await bookingCount(orgId, clientId) : 0;

    for (const row of autos) {
      const a = row.a;
      if (row.status === "archived") continue;
      if (trigger === "on_booking" && a.firstBookingOnly && bookings > 1) continue;
      if (trigger === "after_attended" && attended !== (a.threshold ?? 1)) continue;
      if (await alreadySent(a.formId, clientId)) continue;
      const res = await sendFormToClientsDb(orgId, a.formId, [clientId], sentBy, nowISO);
      const token = res.assignments[0]?.token;
      if (token) sent.push({ formId: a.formId, title: row.title ?? "Form", token });
    }
  } catch {
    /* an automation never breaks the action it rides on */
  }
  return { sent };
}

/* ---- Org → counsellor form sharing (batch 2l) ---- */

/** Set which counsellors may send this form to their own clients. */
export async function setFormSharingDb(orgId: string, formId: string, all: boolean, counsellorIds: string[]): Promise<boolean> {
  return runForOrg(orgId, async () => {
    const res = await activeDb().update(forms)
      .set({ sharedWithAll: all, sharedWith: all ? [] : counsellorIds })
      .where(and(eq(forms.id, formId), eq(forms.orgId, orgId)))
      .returning({ id: forms.id });
    return res.length > 0;
  });
}

export interface CounsellorFormView {
  id: string;
  title: string;
  intro: string | null;
  kind: string;
  fieldCount: number;
  shareToken: string | null;
  shareEnabled: boolean;
}

/** Active forms this counsellor may send (shared with all, or with them). */
export async function formsForCounsellorDb(orgId: string, counsellorId: string): Promise<CounsellorFormView[]> {
  const rows = await getDb().select().from(forms)
    .where(and(eq(forms.orgId, orgId), eq(forms.status, "active")));
  return rows
    .filter((f) => f.sharedWithAll || (f.sharedWith ?? []).includes(counsellorId))
    .map((f) => ({
      id: f.id, title: f.title, intro: f.intro, kind: f.kind,
      fieldCount: Array.isArray(f.fields) ? (f.fields as unknown[]).length : 0,
      shareToken: f.shareToken, shareEnabled: f.shareEnabled,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Is this form shared with this counsellor? (Guards their send action.) */
export async function formSharedWithCounsellorDb(orgId: string, formId: string, counsellorId: string): Promise<boolean> {
  const [f] = await getDb().select({ all: forms.sharedWithAll, list: forms.sharedWith, status: forms.status })
    .from(forms).where(and(eq(forms.id, formId), eq(forms.orgId, orgId))).limit(1);
  if (!f || f.status !== "active") return false;
  return f.all || (f.list ?? []).includes(counsellorId);
}

/* ---- Completed responses on the client record (batch 2l) ---- */

export interface ClientFormResponse {
  id: string;
  formId: string;
  title: string;
  status: string;
  sentAt: string;
  submittedAt: string | null;
  snapshot: { title: string; intro?: string | null; fields: unknown[] };
  answers: Record<string, string> | null;
}

/** Every form sent to a client, newest first - the dossier's Forms section. */
export async function clientFormResponsesDb(orgId: string, clientId: string): Promise<ClientFormResponse[]> {
  const rows = await getDb().select().from(formAssignments)
    .where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.clientId, clientId)));
  return rows
    .map((r) => ({
      id: r.id, formId: r.formId,
      title: (r.snapshot as { title?: string })?.title ?? "Form",
      status: r.status,
      sentAt: r.sentAt.toISOString(),
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      snapshot: r.snapshot as ClientFormResponse["snapshot"],
      answers: (r.answers as Record<string, string> | null) ?? null,
    }))
    .sort((a, b) => (b.submittedAt ?? b.sentAt).localeCompare(a.submittedAt ?? a.sentAt));
}

/** The clients a counsellor may send forms to (their own caseload). */
export async function counsellorClientsDb(orgId: string, counsellorId: string): Promise<{ id: string; name: string }[]> {
  const rows = await getDb().select({ id: clients.id, name: clients.name }).from(clients)
    .where(and(eq(clients.orgId, orgId), eq(clients.primaryCounsellorId, counsellorId), isNull(clients.deletedAt)));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Counsellor ids for a set of user ids (share dialog + guards). */
export async function counsellorIdsForOrgDb(orgId: string): Promise<{ id: string; name: string }[]> {
  const rows = await getDb().select({ id: counsellors.id, name: counsellors.name }).from(counsellors)
    .where(eq(counsellors.orgId, orgId));
  return rows;
}
