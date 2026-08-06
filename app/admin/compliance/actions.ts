"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { createBreachDb, setBreachStatusDb, affectedSubjectsDb } from "@/db/queries/breaches";

/** Phase 31.3 - breach-log actions. Super-admin only; every step audited. */

const createInput = z.object({
  orgId: z.string().trim().max(80).or(z.literal("")),
  title: z.string().trim().min(4, "Give the incident a short title.").max(160),
  description: z.string().trim().min(10, "Describe what happened.").max(4000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  occurredAt: z.string().min(4),
  discoveredAt: z.string().min(4),
  containment: z.string().trim().max(2000).or(z.literal("")),
});

export async function logBreach(raw: z.infer<typeof createInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the incident details." };
  const d = parsed.data;
  await createBreachDb({
    orgId: d.orgId || null, title: d.title, description: d.description, severity: d.severity,
    occurredAt: new Date(d.occurredAt).toISOString(), discoveredAt: new Date(d.discoveredAt).toISOString(),
    containment: d.containment || null, createdBy: principal.userId,
  });
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: d.orgId || null, target: "breach_log", reason: "breach_logged" });
  revalidatePath("/admin/compliance");
  return { ok: true };
}

const statusInput = z.object({ id: z.string().min(1), status: z.enum(["open", "contained", "notified", "closed"]), containment: z.string().trim().max(2000).optional() });

export async function updateBreachStatus(raw: z.infer<typeof statusInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = statusInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await setBreachStatusDb(parsed.data.id, parsed.data.status, parsed.data.containment ?? undefined);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `breach:${parsed.data.id}`, reason: `breach_${parsed.data.status}` });
  revalidatePath("/admin/compliance");
  return { ok: true };
}

/** The affected-subjects list (from the audit trail) + a drafted s22 notice. */
export async function breachAffected(raw: { id: string }): Promise<{ ok: true; subjects: { clientId: string; name: string; reachable: boolean }[]; draft: string } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  if (!raw?.id) return { ok: false, error: "Invalid request" };
  const subjects = await affectedSubjectsDb(raw.id);
  await logAccess({ action: "pii.read", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `breach:${raw.id}/affected`, reason: "s22_affected_list" });
  const draft = [
    "POPIA s22 notification (draft - review with your Information Officer before sending):",
    "",
    "We are writing to let you know about a security incident that may have involved some of your personal information.",
    "What happened: [summarise the incident in plain language].",
    "What information was involved: [state the categories - never more than you know].",
    "What we have done: [containment steps taken].",
    "What you can do: be alert to unusual messages; contact us with any concern.",
    "We have reported the incident to the Information Regulator as required by law.",
  ].join("\n");
  return { ok: true, subjects: subjects.map((s) => ({ clientId: s.clientId, name: s.name, reachable: Boolean(s.phone || s.email) })), draft };
}
