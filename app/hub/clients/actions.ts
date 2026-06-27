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

const importInput = z.object({
  counsellorId: z.string().min(1, "Choose a counsellor for the imported clients."),
  clients: z
    .array(z.object({ name: z.string().min(2), phone: z.string().optional(), email: z.string().optional(), province: z.string().optional() }))
    .min(1, "Nothing to import — add at least one row.")
    .max(500, "Import up to 500 clients at a time."),
});

export async function importClients(
  raw: z.infer<typeof importInput>,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = importInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the import." };

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `clients:import:${parsed.data.clients.length}`,
    reason: "import_clients",
  });
  return { ok: true, count: parsed.data.clients.length };
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
