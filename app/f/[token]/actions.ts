"use server";

import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { isIntakeValid } from "@/components/booking/validation";

/**
 * Public form submission (Phase 18.6). No session  the unguessable token is the
 * capability. Server re-validates required fields against the assignment snapshot,
 * so a hand-crafted request can't skip them. The write is scoped by the token's
 * own assignment (orgId comes from the row, never the caller).
 */
export async function submitForm(raw: { token: string; answers: Record<string, string>; companyToken?: string | null }): Promise<{ ok: true; waitlisted?: boolean } | { ok: false; error: string }> {
  const token = String(raw?.token ?? "");
  if (!token) return { ok: false, error: "This form link is no longer valid." };

  const provider = await getDataProvider();
  const view = await provider.getFormByToken(token);
  if (!view) return { ok: false, error: "This form link is no longer valid." };
  if (view.status === "completed") return { ok: false, error: "This form has already been submitted." };

  const answers: Record<string, string> = {};
  for (const f of view.snapshot.fields) answers[f.id] = String(raw?.answers?.[f.id] ?? "").slice(0, 4000);
  if (!isIntakeValid(view.snapshot.fields, answers)) return { ok: false, error: "Please answer the required questions." };

  const now = clockNow();
  const res = await provider.submitFormResponse(token, answers, now);
  if (!res.ok) return res;

  await logAccess({
    action: "admin.action",
    actor: { userId: "client", platformRole: "client", teamRole: null },
    orgId: view.orgId,
    target: `form_assignment:${view.assignmentId ?? res.assignmentId}`,
    reason: "submit_form_response",
  });

  // Batch 2t - when a form feeds the waitlist (an employer's intake, or any
  // form with the toggle on), the person becomes a real client here and now.
  // A floating response cannot be booked, cannot carry a fee arrangement, and
  // cannot be reported to the employer paying for it.
  let waitlisted = false;
  if (process.env.DATA_PROVIDER === "db" && view.mode === "share") {
    try {
      const companyToken = String(raw?.companyToken ?? "").trim().slice(0, 40);
      const { companyByTokenDb } = await import("@/db/queries/companies");
      const company = companyToken ? await companyByTokenDb(companyToken) : null;
      // A token from another practice is simply not this practice's employer.
      const linked = company && company.orgId === view.orgId ? company : null;

      const { formWaitlistSettingDb, landIntakeResponseDb, contactFromAnswers } = await import("@/db/queries/intake-waitlist");
      const setting = await formWaitlistSettingDb(view.formId);
      const wantsWaitlist = Boolean(setting?.on) || linked?.bookingMode === "practice_books";

      if (linked || wantsWaitlist) {
        const { getDataProvider: getProv } = await import("@/lib/data-provider");
        const org = await (await getProv()).getOrg(view.orgId);
        const landed = await landIntakeResponseDb({
          orgId: view.orgId,
          assignmentId: res.assignmentId,
          companyId: linked?.id ?? null,
          province: org?.province ?? "Gauteng",
          contact: contactFromAnswers(view.snapshot, answers),
          note: linked ? `From ${linked.name}'s intake form` : `From "${view.snapshot.title}"`,
          addToWaitlist: wantsWaitlist,
          now,
        });
        waitlisted = Boolean(landed?.waitlisted);

        if (landed) {
          const { notifyOrgAdmins } = await import("@/db/queries/notifications");
          await notifyOrgAdmins(view.orgId, {
            kind: "intake_completed",
            title: landed.waitlisted ? `${landed.clientName} is waiting for a session` : `${landed.clientName} completed a form`,
            body: `${linked ? `${linked.name} · ` : ""}${view.snapshot.title}. ${landed.created ? "New client record created." : "Matched to an existing client."}`,
            href: landed.waitlisted ? "/hub/waitlist" : `/hub/clients/${landed.clientId}`,
          });
        }
      }
    } catch {
      // Their answers are saved either way - the practice can still act on them.
    }
  }

  // Batch 3j - the practice hears by email, in its own words. Best-effort and
  // bounded: the thank-you screen never waits on a mail server.
  if (process.env.DATA_PROVIDER === "db") {
    try {
      await Promise.race([
        sendSubmitNotification(view.orgId, view.formId, view.orgName, view.snapshot, answers, res.assignmentId),
        new Promise((resolve) => setTimeout(resolve, 4_000)),
      ]);
    } catch { /* the submission stands */ }
  }

  return { ok: true, waitlisted };
}

/** Email the configured recipients (or every org admin) about a submission. */
async function sendSubmitNotification(
  orgId: string,
  formId: string,
  orgName: string,
  snapshot: { title: string; fields: { id: string; label?: string; type?: string }[] },
  answers: Record<string, string>,
  assignmentId: string,
): Promise<void> {
  const { getDb } = await import("@/db/client");
  const { forms, formAssignments, clients } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const db = getDb();
  const [f] = await db.select({ notify: forms.notifyOnSubmit }).from(forms)
    .where(and(eq(forms.id, formId), eq(forms.orgId, orgId))).limit(1);
  const notify = f?.notify as { enabled: boolean; recipients: string[]; subject: string; body: string } | null;
  if (!notify?.enabled) return;

  // Whose response this is: the assigned client, else the name in the answers.
  let name = "Someone";
  const [a] = await db.select({ clientId: formAssignments.clientId, respondentName: formAssignments.respondentName })
    .from(formAssignments).where(eq(formAssignments.id, assignmentId)).limit(1);
  if (a?.clientId) {
    const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, a.clientId)).limit(1);
    if (c?.name) name = c.name;
  } else if (a?.respondentName) {
    name = a.respondentName;
  } else {
    const { contactFromAnswers } = await import("@/db/queries/intake-waitlist");
    name = contactFromAnswers(snapshot as never, answers).name ?? "Someone";
  }

  const { renderNotifyEmail } = await import("@/lib/forms/notify-email");
  const date = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const { subject, body } = renderNotifyEmail(notify, { name, form: snapshot.title, practice: orgName, date });

  let recipients = notify.recipients.filter(Boolean);
  if (recipients.length === 0) {
    const { orgAdminEmailsDb } = await import("@/db/queries/forms");
    recipients = await orgAdminEmailsDb(orgId);
  }
  if (recipients.length === 0) return;

  const { sendEmail } = await import("@/lib/messaging/transports");
  await Promise.allSettled(recipients.slice(0, 10).map((to) => sendEmail(to, subject, body, orgName, null)));
}
