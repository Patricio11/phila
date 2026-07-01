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
export async function submitForm(raw: { token: string; answers: Record<string, string> }): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = String(raw?.token ?? "");
  if (!token) return { ok: false, error: "This form link is no longer valid." };

  const provider = await getDataProvider();
  const view = await provider.getFormByToken(token);
  if (!view) return { ok: false, error: "This form link is no longer valid." };
  if (view.status === "completed") return { ok: false, error: "This form has already been submitted." };

  const answers: Record<string, string> = {};
  for (const f of view.snapshot.fields) answers[f.id] = String(raw?.answers?.[f.id] ?? "").slice(0, 4000);
  if (!isIntakeValid(view.snapshot.fields, answers)) return { ok: false, error: "Please answer the required questions." };

  const res = await provider.submitFormResponse(token, answers, clockNow());
  if (!res.ok) return res;

  await logAccess({
    action: "admin.action",
    actor: { userId: "client", platformRole: "client", teamRole: null },
    orgId: view.orgId,
    target: `form_assignment:${view.assignmentId}`,
    reason: "submit_form_response",
  });
  return { ok: true };
}
