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

  return { ok: true, waitlisted };
}
