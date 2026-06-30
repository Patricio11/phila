import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import type { PlatformRole, TeamRole } from "@/lib/domain/enums";
import { auth } from "@/lib/auth/better-auth";
import { getDb } from "@/db/client";
import { orgMembers, orgs } from "@/db/schema";

/**
 * The authenticated principal  resolved from the real Better Auth session
 * (Phase 9). The *shape* is unchanged from Part A, so every guard and call site
 * is untouched: only the resolver swapped from a fixed mock to a real session.
 *
 * Org staff (counsellor, org_admin, …) carry no platform role  their authority
 * comes from an org membership. `client`, `funder`, and `super_admin` are
 * platform roles. A user may belong to several orgs with a different role in each.
 */
export interface OrgMembership {
  orgId: string;
  orgName: string;
  teamRole: TeamRole;
  isSupervisor: boolean;
}

export interface Principal {
  userId: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  memberships: OrgMembership[];
  activeOrgId: string | null;
  twoFactorEnabled: boolean;
  /** For platform role `client`: the linked client record (their own data). */
  clientId?: string;
}

/**
 * Resolve the current principal from the Better Auth session, or `null` if not
 * signed in. Memberships come from `org_members`; the platform role + client link
 * ride on the user as additional fields.
 */
export async function getCurrentPrincipal(): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as typeof session.user & {
    platformRole?: string | null;
    clientId?: string | null;
    twoFactorEnabled?: boolean | null;
  };

  const db = getDb();
  const rows = await db
    .select({
      orgId: orgMembers.orgId,
      orgName: orgs.name,
      teamRole: orgMembers.teamRole,
      isSupervisor: orgMembers.isSupervisor,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, u.id));

  const memberships: OrgMembership[] = rows.map((r) => ({
    orgId: r.orgId,
    orgName: r.orgName,
    teamRole: r.teamRole as TeamRole,
    isSupervisor: r.isSupervisor,
  }));

  return {
    userId: u.id,
    name: u.name,
    email: u.email,
    platformRole: (u.platformRole ?? null) as PlatformRole | null,
    memberships,
    activeOrgId: memberships[0]?.orgId ?? null,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    clientId: u.clientId ?? undefined,
  };
}

export function activeMembership(principal: Principal): OrgMembership | null {
  return (
    principal.memberships.find((m) => m.orgId === principal.activeOrgId) ?? null
  );
}
