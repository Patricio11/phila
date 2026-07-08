import "server-only";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { runForOrg, activeDb } from "@/lib/db/scoped";
import { appointments, clients } from "@/db/schema";

/**
 * No-show follow-up (W7). A missed session should never fall through the cracks:
 * we surface recent no-shows that haven't been handled yet, so staff can rebook or
 * dismiss them. `no_show_follow_up_at` marks one done so it stops nagging.
 */
export interface NoShowRow {
  appointmentId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  counsellorId: string;
  serviceId: string;
  startsAt: string;
}

/** Recent, unhandled no-shows for the org (optionally one counsellor's). RLS-scoped. */
export async function listUnhandledNoShowsDb(orgId: string, counsellorId: string | null, sinceDays = 45): Promise<NoShowRow[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  return runForOrg(orgId, async () => {
    const rows = await activeDb().select({
      appointmentId: appointments.id, clientId: appointments.clientId, clientName: clients.name, clientPhone: clients.phone,
      counsellorId: appointments.counsellorId, serviceId: appointments.serviceId, startsAt: appointments.startsAt,
    })
      .from(appointments)
      .leftJoin(clients, eq(clients.id, appointments.clientId))
      .where(and(
        eq(appointments.orgId, orgId),
        eq(appointments.state, "no_show"),
        isNull(appointments.noShowFollowUpAt),
        gte(appointments.startsAt, since),
        ...(counsellorId ? [eq(appointments.counsellorId, counsellorId)] : []),
      ))
      .orderBy(desc(appointments.startsAt));
    return rows.map((r) => ({
      appointmentId: r.appointmentId, clientId: r.clientId, clientName: r.clientName ?? "A client", clientPhone: r.clientPhone ?? null,
      counsellorId: r.counsellorId, serviceId: r.serviceId, startsAt: r.startsAt.toISOString(),
    }));
  });
}

/** Mark a no-show handled (rebooked or dismissed) so it drops off the follow-up list. RLS-scoped. */
export async function markNoShowFollowedUpDb(orgId: string, appointmentId: string): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(appointments)
    .set({ noShowFollowUpAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId), eq(appointments.state, "no_show"))));
}
