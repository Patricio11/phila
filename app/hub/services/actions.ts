"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveServices as persistServices } from "@/db/queries/catalogue";

/**
 * The service catalogue (mock)  name, duration, price. This is what the booking
 * flow offers, the calendar schedules, and invoicing bills. The Hub owns it here;
 * Phase 10 persists it to the org. Booking *visibility* (which are public, and
 * in-person/online) lives under Booking; this is the services themselves.
 */
const service = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Each service needs a name.").max(80),
  durationMin: z.number().int().min(5, "Sessions are at least 5 minutes.").max(480),
  priceCents: z.number().int().min(0).max(10_000_00).nullable(),
});

const input = z.object({ services: z.array(service).min(1, "Keep at least one service.") });

export async function saveServices(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the services you entered." };

  const names = parsed.data.services.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, error: "Two services share a name  give each a distinct one." };

  if (process.env.DATA_PROVIDER === "db") await persistServices(membership.orgId, parsed.data.services);

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/services`,
    reason: "update_services",
  });
  return { ok: true };
}
