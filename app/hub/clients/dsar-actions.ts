"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { exportDataSubjectDb, eraseDataSubjectDb, setLegalHoldDb, type DsarExport } from "@/db/queries/dsar";

/**
 * Phase 31.1 — DSAR actions (staff side). Used on request only — never part of
 * the daily loop. Both are FAIL-STRICT audited: if the audit line can't be
 * written, the export/erasure does not happen (same guarantee as clinical reads).
 */

const exportInput = z.object({ clientId: z.string().min(1) });

export async function exportDataSubject(
  raw: z.infer<typeof exportInput>,
): Promise<{ ok: true; data: DsarExport } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = exportInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  // Audit BEFORE the data leaves — a failed audit refuses the export (fail-strict).
  await logAccess({
    action: "dsar.export",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}`,
    reason: "data_subject_access_request",
  });

  const data = await exportDataSubjectDb(membership.orgId, parsed.data.clientId, clockNow());
  if (!data) return { ok: false, error: "Client not found." };
  return { ok: true, data };
}

const eraseInput = z.object({
  clientId: z.string().min(1),
  /** Typed confirmation — must match the client's current name exactly. */
  confirmName: z.string().min(1),
  expectedName: z.string().min(1),
});

export async function eraseDataSubject(
  raw: z.infer<typeof eraseInput>,
): Promise<{ ok: boolean; message: string }> {
  const { principal, membership } = await requireHub();
  const parsed = eraseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid request" };
  if (parsed.data.confirmName.trim() !== parsed.data.expectedName.trim()) {
    return { ok: false, message: "The name you typed doesn't match — nothing was changed." };
  }

  // Fail-strict: no unlogged erasure, ever.
  await logAccess({
    action: "dsar.erase",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}`,
    reason: "data_subject_deletion_request",
  });

  const res = await eraseDataSubjectDb(membership.orgId, parsed.data.clientId, clockNow());
  if (!res) return { ok: false, message: "Client not found." };
  revalidatePath("/hub/clients");
  return { ok: res.ok, message: res.decision.reason };
}

const holdInput = z.object({ clientId: z.string().min(1), on: z.boolean(), reason: z.string().trim().max(300) });

export async function setLegalHold(
  raw: z.infer<typeof holdInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = holdInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await setLegalHoldDb(membership.orgId, parsed.data.clientId, parsed.data.on, parsed.data.reason || null);
  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}`,
    reason: parsed.data.on ? "legal_hold_set" : "legal_hold_lifted",
  });
  revalidatePath(`/hub/clients/${parsed.data.clientId}`);
  return { ok: true };
}
