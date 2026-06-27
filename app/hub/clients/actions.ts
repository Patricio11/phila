"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { PROVINCES } from "@/lib/domain/enums";

/**
 * Client CRUD (mock). Validated + audited; Phase 10/11 persist to Postgres
 * (under RLS) and run the consent state machine on first contact. Creating or
 * moving a client never distorts compiled stats (Outcome-Honesty Rule).
 */
const createInput = z.object({
  name: z.string().min(2, "Enter the client's full name."),
  phone: z.string().regex(/^(\+27|0)\d{9}$/, "Use a SA number, e.g. 082 123 4567.").optional().or(z.literal("")),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  province: z.enum(PROVINCES),
  counsellorId: z.string().min(1, "Assign a counsellor."),
  riskFlag: z.boolean(),
});

export async function createClient(
  raw: z.infer<typeof createInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: "client:new",
    reason: "create_client",
  });
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

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `client:${parsed.data.clientId}`,
    reason: "reassign_client",
  });
  return { ok: true };
}
