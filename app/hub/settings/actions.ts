"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";

/**
 * Working hours (mock). Validated + audited; Phase 11 persists them and the
 * scheduling engine enforces them server-side. Setting a day closed blocks
 * booking on that day across the calendar.
 */
const time = z.string().regex(/^\d{2}:\d{2}$/);
const day = z.object({ start: time, end: time }).nullable();
const input = z.object({
  hours: z.object({
    1: day, 2: day, 3: day, 4: day, 5: day, 6: day, 7: day,
  }),
});

export async function saveBusinessHours(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the times you entered." };
  for (const d of Object.values(parsed.data.hours)) {
    if (d && d.end <= d.start) return { ok: false, error: "Each day's end time must be after its start." };
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/business_hours`,
    reason: "update_business_hours",
  });
  return { ok: true };
}
