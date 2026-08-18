import "server-only";
import { eq } from "drizzle-orm";
import { requireAuth, ForbiddenError } from "@/lib/auth/guard";
import { activeMembership } from "@/lib/auth/session";
import { getDb } from "@/db/client";
import { clients } from "@/db/schema";
import type { TeamRole } from "@/lib/domain/enums";

/**
 * Phase 34.1 - who is speaking in the messaging system. Staff (an org
 * membership) or a CLIENT (their linked client row, scoped to its org). The
 * messaging actions accept both and enforce the client rules downstream:
 * a client only ever reaches their own practice thread, never starts one,
 * never attaches, never manages anyone.
 */
export type MessagingPrincipal =
  | { kind: "staff"; userId: string; name: string; orgId: string; teamRole: TeamRole }
  | { kind: "client"; userId: string; name: string; orgId: string; clientId: string };

export async function requireMessagingPrincipal(): Promise<MessagingPrincipal> {
  const principal = await requireAuth();
  if (principal.platformRole === "client" && principal.clientId) {
    const [row] = await getDb().select({ orgId: clients.orgId }).from(clients).where(eq(clients.id, principal.clientId)).limit(1);
    if (!row) throw new ForbiddenError("Client record not found");
    return { kind: "client", userId: principal.userId, name: principal.name, orgId: row.orgId, clientId: principal.clientId };
  }
  const membership = activeMembership(principal);
  if (!membership) throw new ForbiddenError("Requires an org membership");
  return { kind: "staff", userId: principal.userId, name: principal.name, orgId: membership.orgId, teamRole: membership.teamRole };
}
