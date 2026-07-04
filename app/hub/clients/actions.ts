"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { PROVINCES } from "@/lib/domain/enums";
import { now as clockNow } from "@/lib/clock";
import { getDataProvider } from "@/lib/data-provider";
import { createClientDb, createClientsDb, updateClientDb, setClientRemovedDb, reassignClientDb } from "@/db/queries/clients";

const isDb = () => process.env.DATA_PROVIDER === "db";

/**
 * Client CRUD. Validated + audited, and (under `DATA_PROVIDER=db`) persisted to
 * Postgres via `db/queries/clients`  create/update/reassign write real rows;
 * remove/restore is a soft-delete (`deletedAt`). Every write is org-scoped and
 * never distorts compiled stats (Outcome-Honesty Rule). Mock mode stays audit-only.
 */
/**
 * A client is reachable if we have *either* a phone number or an email  many SA
 * clients have no email, so phone alone is enough. When both exist we prefer email
 * for the portal invite; phone-only clients are invited by SMS. Shared by create,
 * edit, and the public booking flow so the front door is consistent.
 */
const contactShape = {
  phone: z.string().regex(/^(\+27|0)\d{9}$/, "Use a SA number, e.g. 082 123 4567.").optional().or(z.literal("")),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
};
const hasContact = (v: { phone?: string; email?: string }) => Boolean(v.phone?.trim()) || Boolean(v.email?.trim());
const contactMessage = "Add a phone number or an email so we can reach the client.";

const createInput = z
  .object({
    name: z.string().min(2, "Enter the client's full name."),
    ...contactShape,
    province: z.enum(PROVINCES),
    counsellorId: z.string().min(1, "Assign a counsellor."),
    riskFlag: z.boolean(),
    /** Send a portal invite on create (opt-in). Off by default  non-tech clients
     *  are added silently and only invited when the org clicks "Invite to portal". */
    notify: z.boolean().optional(),
  })
  .refine(hasContact, { message: contactMessage, path: ["phone"] });

export async function createClient(
  raw: z.infer<typeof createInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { name, phone, email, province, counsellorId, riskFlag, notify } = parsed.data;
  let clientId = "new";
  if (isDb()) {
    const res = await createClientDb(membership.orgId, { name, phone, email, province, counsellorId, riskFlag }, clockNow());
    clientId = res.id;
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: "client:new",
    reason: "create_client",
  });
  // Portal invite only when explicitly opted in  never a surprise set-password link.
  if (notify) {
    const channel = email?.trim() ? "email" : "sms";
    await logAccess({
      action: "admin.action",
      actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
      orgId: membership.orgId,
      target: `client:${clientId}/portal_invite`,
      reason: `invite_${channel}`,
    });
  }
  revalidatePath("/hub/clients");
  return { ok: true };
}

/**
 * Bulk import (smart import). No counsellor  imported clients land unassigned and
 * the org assigns them from the caseload. Rows arrive already parsed, mapped, and
 * de-duped client-side; the server validates + persists. A missing province falls
 * back to the org's own province (the column is required in the DB).
 */
const importInput = z.object({
  clients: z
    .array(z.object({
      name: z.string().min(2).max(120),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      province: z.string().nullable().optional(),
    }))
    .min(1, "Nothing to import  add at least one row.")
    .max(5000, "Import up to 5000 clients at a time."),
});

export async function importClients(
  raw: z.infer<typeof importInput>,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = importInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the import." };

  let count = parsed.data.clients.length;
  if (isDb()) {
    const provider = await getDataProvider();
    const org = await provider.getOrg(membership.orgId);
    const fallbackProvince = org?.province ?? "Gauteng";
    const rows = parsed.data.clients.map((c) => ({
      name: c.name.trim(),
      phone: c.phone ?? null,
      email: c.email ?? null,
      province: (c.province && c.province.trim()) || fallbackProvince,
    }));
    count = await createClientsDb(membership.orgId, rows, clockNow());
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `clients:import:${count}`,
    reason: "import_clients",
  });
  revalidatePath("/hub/clients");
  return { ok: true, count };
}

const inviteInput = z.object({
  clientId: z.string().min(1),
  channel: z.enum(["whatsapp", "sms", "email"]),
});

/**
 * Invite a client to their portal (mock). Sends a set-password link over the
 * chosen channel  WhatsApp/SMS to their number or email  depending on what
 * the org has enabled and what contact details exist. Validated + audited;
 * nothing is delivered until the Phase 12 channel rail is live.
 */
export async function inviteClientToPortal(
  raw: z.infer<typeof inviteInput>,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = inviteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Couldn't send the invite." };
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}/portal_invite`,
    reason: `invite_${parsed.data.channel}`,
  });
  // The org can copy this link and share it manually if the client can't tap the
  // message. Real per-client tokens land with the Phase 12 channel rail; this points
  // at the client set-password (activation) page today.
  return { ok: true, path: `/activate?role=client&c=${encodeURIComponent(parsed.data.clientId)}` };
}

const updateInput = z
  .object({
    clientId: z.string().min(1),
    name: z.string().min(2, "Enter the client's full name."),
    ...contactShape,
    province: z.enum(PROVINCES),
    counsellorId: z.string().min(1, "Assign a counsellor."),
    riskFlag: z.boolean(),
  })
  .refine(hasContact, { message: contactMessage, path: ["phone"] });

/**
 * Fully edit a client's profile (mock). The org can correct any detail  name,
 * phone, email, province, primary counsellor, safeguarding flag. Validated (still
 * needs a phone or an email) + audited; Phase 10/11 persists under RLS. Editing a
 * client never distorts compiled stats (Outcome-Honesty Rule).
 */
export async function updateClient(
  raw: z.infer<typeof updateInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { clientId, name, phone, email, province, counsellorId, riskFlag } = parsed.data;
  if (isDb()) {
    await updateClientDb(membership.orgId, clientId, { name, phone, email, province, counsellorId, riskFlag });
  }
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${clientId}`,
    reason: "update_client",
  });
  revalidatePath("/hub/clients");
  revalidatePath(`/hub/clients/${clientId}`);
  return { ok: true };
}

const mergeInput = z.object({
  keepId: z.string().min(1),
  mergeIds: z.array(z.string().min(1)).min(1, "Nothing to merge."),
});

/**
 * Merge duplicate client records (mock). Keeps one record; the others are
 * soft-merged into it. Phase 10 re-points sessions/notes/invoices/consents to
 * the kept id and soft-deletes the rest  history is never lost or duplicated
 * (Outcome-Honesty Rule).
 */
export async function mergeClients(
  raw: z.infer<typeof mergeInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = mergeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the merge." };
  if (parsed.data.mergeIds.includes(parsed.data.keepId)) return { ok: false, error: "Can't merge a record into itself." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.keepId}`,
    reason: `merge_clients:${parsed.data.mergeIds.join(",")}`,
  });
  return { ok: true };
}

const clientIdInput = z.object({ clientId: z.string().min(1) });

/**
 * Remove a client from the active caseload (mock  soft-delete in Phase 10/11).
 * Nothing is destroyed: the record + full history are retained and the client
 * moves to the "Removed" view, restorable at any time. Audited.
 */
export async function removeClient(raw: z.infer<typeof clientIdInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = clientIdInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Not found." };
  if (isDb()) await setClientRemovedDb(membership.orgId, parsed.data.clientId, true, clockNow());
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `client:${parsed.data.clientId}`, reason: "remove_client" });
  revalidatePath("/hub/clients");
  return { ok: true };
}

/** Restore a previously-removed client to the active caseload. Audited. */
export async function restoreClient(raw: z.infer<typeof clientIdInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = clientIdInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Not found." };
  if (isDb()) await setClientRemovedDb(membership.orgId, parsed.data.clientId, false, clockNow());
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `client:${parsed.data.clientId}`, reason: "restore_client" });
  revalidatePath("/hub/clients");
  return { ok: true };
}

const reassignInput = z.object({
  clientId: z.string().min(1),
  counsellorId: z.string().min(1, "Pick a counsellor."),
});

export async function reassignClient(
  raw: z.infer<typeof reassignInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = reassignInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pick a counsellor." };

  if (isDb()) await reassignClientDb(membership.orgId, parsed.data.clientId, parsed.data.counsellorId);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}`,
    reason: "reassign_client",
  });
  revalidatePath("/hub/clients");
  revalidatePath(`/hub/clients/${parsed.data.clientId}`);
  return { ok: true };
}
