import "server-only";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { randomUUID } from "node:crypto";
import { formAutomations, forms, formAssignments, appointments, clients, counsellors } from "@/db/schema";
import { getFormDb, snapshotOf, token as newToken } from "@/db/queries/forms";
import { createNotification } from "@/db/queries/notifications";

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
/** Batch 4p - who fills the form. */
export type AutomationRecipient = "client" | "counsellor" | "both";

export interface AutomationView {
  id: string;
  formId: string;
  formTitle: string;
  trigger: AutomationTrigger;
  threshold: number | null;
  firstBookingOnly: boolean;
  recipient: AutomationRecipient;
  everySession: boolean;
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
      recipient: (r.a.recipient as AutomationRecipient) ?? "client", everySession: r.a.everySession,
    }));
  });
}

export async function createAutomationDb(orgId: string, input: { formId: string; trigger: AutomationTrigger; threshold: number | null; firstBookingOnly: boolean; recipient?: AutomationRecipient; everySession?: boolean; createdBy: string }): Promise<string> {
  return runForOrg(orgId, async () => {
    const [row] = await activeDb().insert(formAutomations).values({
      orgId, formId: input.formId, trigger: input.trigger,
      threshold: input.trigger === "after_attended" && !input.everySession ? input.threshold ?? 1 : null,
      firstBookingOnly: input.trigger === "on_booking" ? input.firstBookingOnly : false,
      recipient: input.recipient ?? "client",
      everySession: input.trigger === "after_attended" ? Boolean(input.everySession) : false,
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

export interface AutomationContext {
  /** The appointment that fired this (booking created / session held). */
  appointmentId?: string | null;
  /** The counsellor on that appointment (falls back to the client's primary counsellor). */
  counsellorId?: string | null;
}

export interface AutomationRunResult {
  /** Client fills - the caller delivers the link on the client's channel. */
  sent: { formId: string; title: string; token: string }[];
  /** Counsellor fills - already belled inside the engine; returned for the caller's record. */
  counsellorFills: { formId: string; title: string; token: string; counsellorId: string }[];
}

/**
 * Run every matching automation for a client. Called after a booking is created
 * and after a session is marked held. Best-effort and silent: an automation must
 * never break the booking or the session it rides on.
 *
 * Batch 4p - each automation says WHO fills it (client / counsellor / both) and
 * after_attended can fire after EVERY session. Idempotence is structural:
 *   - once-only automations: one fill per (form, client[, counsellor]) ever;
 *   - every-session automations: one fill per (form, client[, counsellor], appointment).
 * A counsellor fill is an in-app task (bell + "To fill" on their Forms page), never
 * a WhatsApp / SMS - the link is still the token's fill page, addressed to them.
 */
export async function runFormAutomations(
  orgId: string,
  clientId: string,
  trigger: AutomationTrigger,
  sentBy: string,
  nowISO: string,
  ctx: AutomationContext = {},
): Promise<AutomationRunResult> {
  const sent: AutomationRunResult["sent"] = [];
  const counsellorFills: AutomationRunResult["counsellorFills"] = [];
  try {
    const db = getDb();
    const autos = await db.select({ a: formAutomations, title: forms.title, status: forms.status })
      .from(formAutomations)
      .leftJoin(forms, eq(formAutomations.formId, forms.id))
      .where(and(eq(formAutomations.orgId, orgId), eq(formAutomations.trigger, trigger), eq(formAutomations.active, true)));
    if (autos.length === 0) return { sent, counsellorFills };

    const [client] = await db.select({ id: clients.id, name: clients.name, primary: clients.primaryCounsellorId }).from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId), isNull(clients.deletedAt))).limit(1);
    if (!client) return { sent, counsellorFills };

    const attended = trigger === "after_attended" ? await attendedCount(orgId, clientId) : 0;
    const bookings = trigger === "on_booking" ? await bookingCount(orgId, clientId) : 0;
    const at = new Date(nowISO);
    const appointmentId = ctx.appointmentId ?? null;

    // Existing fills of these forms for this client - the idempotence ledger.
    const formIds = Array.from(new Set(autos.map((r) => r.a.formId)));
    const existing = await db.select({ formId: formAssignments.formId, counsellorId: formAssignments.counsellorId, appointmentId: formAssignments.appointmentId, status: formAssignments.status, token: formAssignments.token })
      .from(formAssignments)
      .where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.clientId, clientId), inArray(formAssignments.formId, formIds)));
    const already = (formId: string, counsellorId: string | null, perAppointment: boolean) =>
      existing.some((e) => e.formId === formId && (e.counsellorId ?? null) === counsellorId && (!perAppointment || e.appointmentId === appointmentId));

    for (const row of autos) {
      const a = row.a;
      if (row.status === "archived") continue;
      if (trigger === "on_booking" && a.firstBookingOnly && bookings > 1) continue;
      if (trigger === "after_attended" && !a.everySession && attended !== (a.threshold ?? 1)) continue;
      const perAppointment = a.everySession && Boolean(appointmentId);
      const recipient = (a.recipient as AutomationRecipient) ?? "client";
      const form = await getFormDb(orgId, a.formId);
      if (!form) continue;
      const snapshot = snapshotOf(form);

      // → the client
      if (recipient === "client" || recipient === "both") {
        if (!already(a.formId, null, perAppointment)) {
          // A still-open fill of the same form is re-sent rather than duplicated.
          const open = existing.find((e) => e.formId === a.formId && !e.counsellorId && e.status === "sent");
          let tok = open?.token ?? null;
          if (!tok) {
            tok = newToken();
            await db.insert(formAssignments).values({ id: `fa_${randomUUID().slice(0, 12)}`, orgId, formId: a.formId, clientId, counsellorId: null, appointmentId, token: tok, status: "sent", snapshot, answers: null, sentBy, sentAt: at, submittedAt: null });
            existing.push({ formId: a.formId, counsellorId: null, appointmentId, status: "sent", token: tok });
          }
          sent.push({ formId: a.formId, title: row.title ?? form.title, token: tok });
        }
      }

      // → the counsellor (the one on the appointment, else the client's primary counsellor)
      if (recipient === "counsellor" || recipient === "both") {
        const counsellorId = ctx.counsellorId ?? client.primary ?? null;
        if (counsellorId && !already(a.formId, counsellorId, perAppointment)) {
          const [c] = await db.select({ id: counsellors.id, userId: counsellors.userId, name: counsellors.name }).from(counsellors)
            .where(and(eq(counsellors.id, counsellorId), eq(counsellors.orgId, orgId))).limit(1);
          if (c?.userId) {
            const tok = newToken();
            await db.insert(formAssignments).values({ id: `fa_${randomUUID().slice(0, 12)}`, orgId, formId: a.formId, clientId, counsellorId, appointmentId, token: tok, status: "sent", snapshot, answers: null, sentBy, sentAt: at, submittedAt: null });
            existing.push({ formId: a.formId, counsellorId, appointmentId, status: "sent", token: tok });
            counsellorFills.push({ formId: a.formId, title: row.title ?? form.title, token: tok, counsellorId });
            const first = client.name.split(" ")[0] ?? "a client";
            await createNotification({
              userId: c.userId, orgId, kind: "form_fill",
              title: `Fill in: ${row.title ?? form.title} for ${first}`,
              body: trigger === "after_attended" ? "After today's session - a couple of minutes." : "A new booking - fill this in when you're ready.",
              href: `/f/${tok}`,
            }).catch(() => {});
          }
        }
      }
    }
  } catch {
    /* an automation never breaks the action it rides on */
  }
  return { sent, counsellorFills };
}

/* ---- Batch 4p - the counsellor's "To fill" list ---- */

export interface CounsellorFill { assignmentId: string; token: string; formTitle: string; clientId: string; clientName: string; sentAt: string }

/** Forms waiting for THIS counsellor to fill (about their clients), newest first. */
export async function counsellorFillsDb(orgId: string, counsellorId: string): Promise<CounsellorFill[]> {
  const rows = await getDb().select({ id: formAssignments.id, token: formAssignments.token, snapshot: formAssignments.snapshot, clientId: formAssignments.clientId, clientName: clients.name, sentAt: formAssignments.sentAt })
    .from(formAssignments)
    .leftJoin(clients, eq(clients.id, formAssignments.clientId))
    .where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.counsellorId, counsellorId), eq(formAssignments.status, "sent")));
  return rows
    .map((r) => ({ assignmentId: r.id, token: r.token, formTitle: (r.snapshot as { title?: string })?.title ?? "Form", clientId: r.clientId ?? "", clientName: r.clientName ?? "Client", sentAt: r.sentAt.toISOString() }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
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
  /** Batch 4p - "Filled by Nomsa (counsellor)" when a counsellor is the respondent; null = the client. */
  filledBy: string | null;
}

/** Every form sent to a client, newest first - the dossier's Forms section. */
export async function clientFormResponsesDb(orgId: string, clientId: string): Promise<ClientFormResponse[]> {
  const rows = await getDb().select({ a: formAssignments, fillerName: counsellors.name }).from(formAssignments)
    .leftJoin(counsellors, eq(counsellors.id, formAssignments.counsellorId))
    .where(and(eq(formAssignments.orgId, orgId), eq(formAssignments.clientId, clientId)));
  return rows
    .map(({ a: r, fillerName }) => ({
      id: r.id, formId: r.formId,
      title: (r.snapshot as { title?: string })?.title ?? "Form",
      filledBy: r.counsellorId ? (fillerName ?? "a counsellor") : null,
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
