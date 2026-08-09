"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";

/**
 * Batch 2l - a counsellor sends a form the practice shared with them, to their
 * OWN clients. Both halves are server-guarded: the form must be shared with
 * them, and every client must be on their caseload.
 */
export async function sendFormToMyClients(
  raw: { formId: string; clientIds: string[] },
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) return { ok: false, error: "Not found." };

  const formId = String(raw?.formId ?? "");
  const clientIds = (raw?.clientIds ?? []).map(String).filter(Boolean);
  if (!formId || clientIds.length === 0) return { ok: false, error: "Pick at least one client." };

  const { formSharedWithCounsellorDb, counsellorClientsDb } = await import("@/db/queries/form-automations");
  if (!(await formSharedWithCounsellorDb(membership.orgId, formId, me.id))) {
    return { ok: false, error: "That form isn't shared with you." };
  }
  const mine = new Set((await counsellorClientsDb(membership.orgId, me.id)).map((c) => c.id));
  if (clientIds.some((id) => !mine.has(id))) return { ok: false, error: "You can only send to your own clients." };

  const form = await provider.getForm(membership.orgId, formId);
  if (!form) return { ok: false, error: "That form couldn't be found." };
  const res = await provider.sendFormToClients(membership.orgId, formId, clientIds, principal.userId, clockNow());
  try {
    const { notifyFormSent } = await import("@/lib/messaging/notify-form");
    await notifyFormSent(membership.orgId, form.title, res.assignments);
  } catch { /* a notification never blocks the send */ }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `form:${formId}`,
    reason: `counsellor_send_form:${res.sent}`,
  });
  revalidatePath("/app/forms");
  return { ok: true, sent: res.sent };
}
