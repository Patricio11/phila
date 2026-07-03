"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { FUNDER_TYPES, GRANT_STATUSES, REPORTING_SCHEDULES } from "@/lib/domain/enums";
import { INDICATOR_METRICS, indicatorMeta } from "@/lib/domain/indicator-catalogue";
import {
  createFunderDb, updateFunderDb, deleteFunderDb,
  createGrantDb, updateGrantDb, deleteGrantDb,
  setGrantIndicatorsDb, setGrantAllocationsDb, getGrantOrgId, inviteFunderContactDb,
  type IndicatorInput,
} from "@/db/queries/grants";

/**
 * Funders & grants CRUD (Phase 18.8) — real, org-scoped M&E. The org builds its own
 * funders, grants, indicators and client allocations; the reporting engine already
 * rolls the actuals up live. Every write is validated, org-scoped, and audited.
 */
const isDb = () => process.env.DATA_PROVIDER === "db";
const ok = (revalidate: string[] = []) => { for (const p of revalidate) revalidatePath(p); return { ok: true } as const; };

async function actor() {
  const { principal, membership } = await requireHub();
  return {
    orgId: membership.orgId,
    log: (target: string, reason: string) =>
      logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target, reason }),
  };
}

/* ── Funders ──────────────────────────────────────────────────────────── */

const funderInput = z.object({
  name: z.string().min(2, "Enter the funder's name."),
  type: z.enum(FUNDER_TYPES),
  contactName: z.string().trim().optional().or(z.literal("")),
  contactEmail: z.string().email("Enter a valid email.").optional().or(z.literal("")),
});

export async function createFunder(raw: z.infer<typeof funderInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const p = funderInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details." };
  if (isDb()) await createFunderDb(orgId, { name: p.data.name, type: p.data.type, contactName: p.data.contactName ?? "", contactEmail: p.data.contactEmail ?? "" });
  await log("funder:new", "create_funder");
  return ok(["/hub/funders"]);
}

export async function updateFunder(raw: z.infer<typeof funderInput> & { funderId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const p = funderInput.extend({ funderId: z.string().min(1) }).safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details." };
  if (isDb()) await updateFunderDb(orgId, p.data.funderId, { name: p.data.name, type: p.data.type, contactName: p.data.contactName ?? "", contactEmail: p.data.contactEmail ?? "" });
  await log(`funder:${p.data.funderId}`, "update_funder");
  return ok(["/hub/funders"]);
}

export async function deleteFunder(raw: { funderId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const funderId = String(raw.funderId ?? "");
  if (!funderId) return { ok: false, error: "Not found." };
  if (isDb()) await deleteFunderDb(orgId, funderId);
  await log(`funder:${funderId}`, "delete_funder");
  return ok(["/hub/funders"]);
}

/* ── Grants (+ indicators) ────────────────────────────────────────────── */

const indicator = z.object({ metric: z.enum(INDICATOR_METRICS), target: z.number().int().min(0).max(1_000_000), name: z.string().trim().optional() });
const grantInput = z.object({
  funderId: z.string().min(1, "Choose a funder."),
  title: z.string().min(2, "Give the grant a title."),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
  amountRands: z.number().int().min(0).max(1_000_000_000),
  restricted: z.boolean(),
  reportingSchedule: z.enum(REPORTING_SCHEDULES),
  status: z.enum(GRANT_STATUSES),
  indicators: z.array(indicator).max(12),
}).refine((v) => v.periodEnd > v.periodStart, { message: "The end date must be after the start.", path: ["periodEnd"] });

/** Map the chosen metric + target to a full indicator row (type/unit/rule from the catalogue). */
function toIndicatorInputs(rows: z.infer<typeof indicator>[]): IndicatorInput[] {
  return rows.map((r) => {
    const meta = indicatorMeta(r.metric)!;
    return { name: r.name?.trim() || meta.label, type: meta.type, metric: r.metric, target: r.target, unit: meta.unit, rule: meta.rule };
  });
}

export async function createGrant(raw: z.infer<typeof grantInput>): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const p = grantInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the grant." };
  let id: string | undefined;
  if (isDb()) {
    const res = await createGrantDb(orgId, { funderId: p.data.funderId, title: p.data.title, periodStart: p.data.periodStart, periodEnd: p.data.periodEnd, amountCents: p.data.amountRands * 100, restricted: p.data.restricted, reportingSchedule: p.data.reportingSchedule, status: p.data.status });
    id = res.id;
    await setGrantIndicatorsDb(id, toIndicatorInputs(p.data.indicators));
  }
  await log("grant:new", "create_grant");
  revalidatePath("/hub/funders");
  return { ok: true, id };
}

export async function updateGrant(raw: z.infer<typeof grantInput> & { grantId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const p = grantInput.extend({ grantId: z.string().min(1) }).safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the grant." };
  if (isDb()) {
    if ((await getGrantOrgId(p.data.grantId)) !== orgId) return { ok: false, error: "Not found." };
    await updateGrantDb(orgId, p.data.grantId, { funderId: p.data.funderId, title: p.data.title, periodStart: p.data.periodStart, periodEnd: p.data.periodEnd, amountCents: p.data.amountRands * 100, restricted: p.data.restricted, reportingSchedule: p.data.reportingSchedule, status: p.data.status });
    await setGrantIndicatorsDb(p.data.grantId, toIndicatorInputs(p.data.indicators));
  }
  await log(`grant:${p.data.grantId}`, "update_grant");
  revalidatePath("/hub/funders");
  revalidatePath(`/hub/grants/${p.data.grantId}`);
  return { ok: true };
}

export async function deleteGrant(raw: { grantId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const grantId = String(raw.grantId ?? "");
  if (!grantId) return { ok: false, error: "Not found." };
  if (isDb()) await deleteGrantDb(orgId, grantId);
  await log(`grant:${grantId}`, "delete_grant");
  revalidatePath("/hub/funders");
  return { ok: true };
}

/* ── Client allocation ────────────────────────────────────────────────── */

const allocInput = z.object({ grantId: z.string().min(1), clientIds: z.array(z.string().min(1)).max(5000) });

export async function setGrantClients(raw: z.infer<typeof allocInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const p = allocInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "Couldn't update the tagged clients." };
  if (isDb()) {
    if ((await getGrantOrgId(p.data.grantId)) !== orgId) return { ok: false, error: "Not found." };
    await setGrantAllocationsDb(p.data.grantId, p.data.clientIds);
  }
  await log(`grant:${p.data.grantId}/allocations`, `set_allocations:${p.data.clientIds.length}`);
  revalidatePath(`/hub/grants/${p.data.grantId}`);
  return { ok: true };
}

/* ── Funder invite (read-only, grant-scoped) ──────────────────────────── */

const inviteInput = z.object({
  funderId: z.string().min(1, "Choose a funder."),
  grantIds: z.array(z.string().min(1)).min(1, "Pick at least one grant to share."),
  email: z.string().email("Enter the funder's email."),
  name: z.string().trim().optional(),
});

/**
 * Invite a funder to a read-only portal scoped to the chosen grant(s). Provisions a
 * funder login (they set a password via the activation link) and records the scope.
 * Returns a shareable activation path for the org to send.
 */
export async function inviteFunder(raw: z.infer<typeof inviteInput>): Promise<{ ok: true; path: string; existing: boolean } | { ok: false; error: string }> {
  const { orgId, log } = await actor();
  const p = inviteInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the invite." };
  let existing = false;
  if (isDb()) {
    for (const gid of p.data.grantIds) if ((await getGrantOrgId(gid)) !== orgId) return { ok: false, error: "That grant isn't yours to share." };
    const res = await inviteFunderContactDb(p.data.funderId, p.data.grantIds, p.data.email, p.data.name ?? "");
    existing = res.existing;
  }
  await log(`funder:${p.data.funderId}/invite`, `invite_funder:${p.data.grantIds.length}`);
  return { ok: true, path: "/activate?role=funder", existing };
}
