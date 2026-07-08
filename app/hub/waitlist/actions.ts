"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { addWaitlistDb, removeWaitlistDb, placeWaitlistDb, isClientWaitingDb } from "@/db/queries/waitlist";

const SCHEDULERS = ["counsellor", "org_admin", "front_desk"] as const;
const isDb = () => process.env.DATA_PROVIDER === "db";

const addInput = z.object({
  clientId: z.string().min(1),
  counsellorId: z.string().min(1).nullable().optional(),
  serviceId: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(280).optional(),
});

/** Add a client to the waitlist (W7). When a slot frees up, matching entries are offered it. */
export async function addToWaitlist(
  raw: z.infer<typeof addInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = addInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the details." };
  if (isDb()) {
    if (await isClientWaitingDb(membership.orgId, parsed.data.clientId)) return { ok: false, error: "This client is already on the waitlist." };
    await addWaitlistDb(membership.orgId, { clientId: parsed.data.clientId, counsellorId: parsed.data.counsellorId ?? null, serviceId: parsed.data.serviceId ?? null, note: parsed.data.note ?? null });
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `client:${parsed.data.clientId}/waitlist`, reason: "waitlist_add" });
  revalidatePath("/hub/appointments");
  revalidatePath(`/hub/clients/${parsed.data.clientId}`);
  return { ok: true };
}

const idInput = z.object({ id: z.string().min(1) });

export async function removeFromWaitlist(raw: z.infer<typeof idInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...SCHEDULERS]);
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (isDb()) await removeWaitlistDb(membership.orgId, parsed.data.id);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: membership.orgId, target: `waitlist:${parsed.data.id}`, reason: "waitlist_remove" });
  revalidatePath("/hub/appointments");
  return { ok: true };
}

/** Mark a waitlist entry placed (the client was booked into a slot). */
export async function placeWaitlist(raw: z.infer<typeof idInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membership } = await requireOrg([...SCHEDULERS]);
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (isDb()) await placeWaitlistDb(membership.orgId, parsed.data.id);
  revalidatePath("/hub/appointments");
  return { ok: true };
}
